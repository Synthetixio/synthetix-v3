//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IRewardDistributor} from "@synthetixio/main/contracts/interfaces/external/IRewardDistributor.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {AccountRBAC} from "@synthetixio/main/contracts/storage/AccountRBAC.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {FeatureFlag} from "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IMarginModule} from "../interfaces/IMarginModule.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {Position} from "../storage/Position.sol";
import {Margin} from "../storage/Margin.sol";
import {AddressRegistry} from "../storage/AddressRegistry.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {Flags} from "../utils/Flags.sol";

contract MarginModule is IMarginModule {
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;
    using Position for Position.Data;
    using Margin for Margin.GlobalData;
    using Margin for Margin.Data;

    // --- Constants --- //

    uint256 private constant MAX_SUPPORTED_MARGIN_COLLATERALS = 10;

    // --- Immutables --- //

    address immutable SYNTHETIX_CORE;
    address immutable SYNTHETIX_SUSD;
    address immutable ORACLE_MANAGER;

    constructor(address _synthetix) {
        SYNTHETIX_CORE = _synthetix;
        ISynthetixSystem core = ISynthetixSystem(_synthetix);
        SYNTHETIX_SUSD = address(core.getUsdToken());
        ORACLE_MANAGER = address(core.getOracleManager());

        if (
            _synthetix == address(0) || ORACLE_MANAGER == address(0) || SYNTHETIX_SUSD == address(0)
        ) {
            revert ErrorUtil.InvalidCoreAddress(_synthetix);
        }
    }

    // --- Runtime structs --- //

    struct Runtime_setMarginCollateralConfiguration {
        uint256 lengthBefore;
        uint256 lengthAfter;
        uint256 maxApproveAmount;
        address[] previousSupportedCollaterals;
    }

    // --- Helpers --- //

    /// @dev Validation account and position after accounting update to verify margin requirements are acceptable.
    function validateAccountAndPositionOnWithdrawal(
        uint128 accountId,
        PerpMarket.Data storage market,
        Position.Data storage position,
        uint256 oraclePrice
    ) private view {
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice,
            addresses
        );

        // Make sure margin isn't liquidatable due to debt.
        if (Margin.isMarginLiquidatable(accountId, market, marginValues, addresses)) {
            revert ErrorUtil.InsufficientMargin();
        }

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(market.id);

        // Ensure does not lead to instant liquidation.
        if (position.isLiquidatable(oraclePrice, marketConfig, marginValues, addresses)) {
            revert ErrorUtil.CanLiquidatePosition();
        }

        (uint256 im, ) = Position.getLiquidationMarginUsd(
            position.size,
            oraclePrice,
            marginValues.collateralUsd,
            marketConfig,
            addresses
        );

        // We use the discount adjusted price here due to the explicit liquidation check.
        if (marginValues.discountedMarginUsd < im) {
            revert ErrorUtil.InsufficientMargin();
        }
    }

    /// @dev Performs a collateral withdraw from Synthetix, ERC20 transfer, and emits event.
    function withdrawAndTransfer(
        uint128 marketId,
        uint256 amount,
        address collateralAddress
    ) private {
        address msgSender = ERC2771Context._msgSender();

        if (collateralAddress == SYNTHETIX_SUSD) {
            ISynthetixSystem(SYNTHETIX_CORE).withdrawMarketUsd(marketId, msgSender, amount);
        } else {
            ISynthetixSystem(SYNTHETIX_CORE).withdrawMarketCollateral(
                marketId,
                collateralAddress,
                amount
            );
            ITokenModule(collateralAddress).transfer(msgSender, amount);
        }
        emit MarginWithdraw(address(this), msgSender, amount, collateralAddress);
    }

    /// @dev Performs an ERC20 transfer, deposits collateral to Synthetix, and emits event.
    function transferAndDeposit(
        uint128 marketId,
        uint256 amount,
        address collateralAddress
    ) private {
        address msgSender = ERC2771Context._msgSender();

        if (collateralAddress == SYNTHETIX_SUSD) {
            ISynthetixSystem(SYNTHETIX_CORE).depositMarketUsd(marketId, msgSender, amount);
        } else {
            ITokenModule(collateralAddress).transferFrom(msgSender, address(this), amount);
            ISynthetixSystem(SYNTHETIX_CORE).depositMarketCollateral(
                marketId,
                collateralAddress,
                amount
            );
        }
        emit MarginDeposit(msgSender, address(this), amount, collateralAddress);
    }

    /// @dev Given a `collateral` determine if tokens of collateral has been deposited in any market.
    function isCollateralDeposited(address collateralAddress) private view returns (bool) {
        PerpMarket.GlobalData storage globalPerpMarket = PerpMarket.load();

        uint128[] memory activeMarketIds = globalPerpMarket.activeMarketIds;
        uint256 activeMarketIdsLength = activeMarketIds.length;

        // In practice, we should only have one perp market but this has been designed to allow for many. So,
        // we should consider that possibility and iterate over all active markets.
        for (uint256 i = 0; i < activeMarketIdsLength; ) {
            PerpMarket.Data storage market = PerpMarket.load(activeMarketIds[i]);

            if (market.depositedCollateral[collateralAddress] > 0) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    // --- Mutations --- //

    /// @inheritdoc IMarginModule
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external {
        FeatureFlag.ensureAccessToFeature(Flags.WITHDRAW);
        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        PerpMarket.Data storage market = PerpMarket.exists(marketId);

        // Prevent collateral transfers when there's a pending order.
        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        // Prevent withdraw all transfers when there's an open position.
        Position.Data storage position = market.positions[accountId];
        if (position.size != 0) {
            revert ErrorUtil.PositionFound(accountId, marketId);
        }

        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        // Prevent withdraw all when there is unpaid debt owned on the account margin.
        if (accountMargin.debtUsd != 0) {
            revert ErrorUtil.DebtFound(accountId, marketId);
        }

        uint256 oraclePrice = market.getOraclePrice(addresses);
        (int128 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(
            marketId,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );

        (uint128 utilizationRate, ) = market.recomputeUtilization(oraclePrice, addresses);
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedCollaterals.length;
        address collateralAddress;
        uint256 available;
        uint256 total;

        for (uint256 i = 0; i < length; ++i) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            available = accountMargin.collaterals[collateralAddress];

            if (available == 0) {
                continue;
            }

            total += available;

            // All collateral withdrawn from `accountMargin`, can be set directly to zero.
            accountMargin.collaterals[collateralAddress] = 0;

            market.depositedCollateral[collateralAddress] -= available;

            // Withdraw all available collateral
            withdrawAndTransfer(marketId, available, collateralAddress);
        }

        // No collateral has been withdrawn. Revert instead of noop.
        if (total == 0) {
            revert ErrorUtil.NilCollateral();
        }
    }

    /// @inheritdoc IMarginModule
    function modifyCollateral(
        uint128 accountId,
        uint128 marketId,
        address collateralAddress,
        int256 amountDelta
    ) external {
        // Revert on zero amount operations rather than no-op.
        if (amountDelta == 0) {
            revert ErrorUtil.ZeroAmount();
        }

        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        Margin.CollateralType storage collateral = globalMarginConfig.supported[collateralAddress];
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        // Prevent any operations if this synth isn't supported as collateral.
        if (!collateral.exists) {
            revert ErrorUtil.UnsupportedCollateral(collateralAddress);
        }

        // Prevent collateral transfers when there's a pending order.
        if (market.orders[accountId].sizeDelta != 0) {
            revert ErrorUtil.OrderFound();
        }

        // Position is frozen due to prior flagged for liquidation.
        if (market.flaggedLiquidations[accountId] != address(0)) {
            revert ErrorUtil.PositionFlagged();
        }

        Margin.Data storage accountMargin = Margin.load(accountId, marketId);
        uint256 absAmountDelta = MathUtil.abs(amountDelta);

        uint256 oraclePrice = market.getOraclePrice(addresses);
        (int128 fundingRate, ) = market.recomputeFunding(oraclePrice);
        emit FundingRecomputed(
            marketId,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );

        (uint128 utilizationRate, ) = market.recomputeUtilization(oraclePrice, addresses);
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);

        // > 0 is a deposit whilst < 0 is a withdrawal.
        if (amountDelta > 0) {
            FeatureFlag.ensureAccessToFeature(Flags.DEPOSIT);

            uint256 maxAllowable = collateral.maxAllowable;
            uint256 totalMarketAvailableAmount = market.depositedCollateral[collateralAddress];

            // Verify whether this will exceed the maximum allowable collateral amount.
            if (totalMarketAvailableAmount + absAmountDelta > maxAllowable) {
                revert ErrorUtil.MaxCollateralExceeded(absAmountDelta, maxAllowable);
            }
            accountMargin.collaterals[collateralAddress] += absAmountDelta;
            market.depositedCollateral[collateralAddress] += absAmountDelta;
            transferAndDeposit(marketId, absAmountDelta, collateralAddress);
        } else {
            FeatureFlag.ensureAccessToFeature(Flags.WITHDRAW);
            if (accountMargin.debtUsd != 0) {
                revert ErrorUtil.DebtFound(accountId, marketId);
            }

            // Verify the collateral previously associated to this account is enough to cover withdrawals.
            if (accountMargin.collaterals[collateralAddress] < absAmountDelta) {
                revert ErrorUtil.InsufficientCollateral(
                    collateralAddress,
                    accountMargin.collaterals[collateralAddress],
                    absAmountDelta
                );
            }

            accountMargin.collaterals[collateralAddress] -= absAmountDelta;
            market.depositedCollateral[collateralAddress] -= absAmountDelta;

            // Verify account and position remain solvent.
            Position.Data storage position = market.positions[accountId];
            if (position.size != 0) {
                validateAccountAndPositionOnWithdrawal(accountId, market, position, oraclePrice);
            }

            // Perform the actual withdraw & transfer from Synthetix Core to msg.sender.
            withdrawAndTransfer(marketId, absAmountDelta, collateralAddress);
        }
    }

    /// @inheritdoc IMarginModule
    function setCollateralMaxAllowable(address collateralAddress, uint128 maxAllowable) external {
        OwnableStorage.onlyOwner();

        Margin.GlobalData storage globalMarginConfig = Margin.load();
        uint256 length = globalMarginConfig.supportedCollaterals.length;
        for (uint256 i = 0; i < length; ) {
            address currentCollateral = globalMarginConfig.supportedCollaterals[i];
            if (currentCollateral == collateralAddress) {
                globalMarginConfig.supported[currentCollateral].maxAllowable = maxAllowable;
                return;
            }
            unchecked {
                ++i;
            }
        }
        revert ErrorUtil.UnsupportedCollateral(collateralAddress);
    }

    /// @inheritdoc IMarginModule
    function setMarginCollateralConfiguration(
        address[] calldata collateralAddresses,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables,
        uint128[] calldata skewScales,
        address[] calldata rewardDistributors
    ) external {
        OwnableStorage.onlyOwner();

        Margin.GlobalData storage globalMarginConfig = Margin.load();

        Runtime_setMarginCollateralConfiguration memory runtime;
        runtime.lengthBefore = globalMarginConfig.supportedCollaterals.length;
        runtime.lengthAfter = collateralAddresses.length;
        runtime.maxApproveAmount = type(uint256).max;
        runtime.previousSupportedCollaterals = globalMarginConfig.supportedCollaterals;
        // Number of synth collaterals to configure exceeds system maxmium.
        if (runtime.lengthAfter > MAX_SUPPORTED_MARGIN_COLLATERALS) {
            revert ErrorUtil.MaxCollateralExceeded(
                runtime.lengthAfter,
                MAX_SUPPORTED_MARGIN_COLLATERALS
            );
        }

        // Ensure all supplied arrays have the same length.
        if (
            oracleNodeIds.length != runtime.lengthAfter ||
            maxAllowables.length != runtime.lengthAfter ||
            rewardDistributors.length != runtime.lengthAfter ||
            skewScales.length != runtime.lengthAfter
        ) {
            revert ErrorUtil.ArrayLengthMismatch();
        }

        // Clear existing collateral configuration to be replaced with new.
        for (uint256 i = 0; i < runtime.lengthBefore; ) {
            address collateralAddress = globalMarginConfig.supportedCollaterals[i];
            delete globalMarginConfig.supported[collateralAddress];

            ITokenModule(collateralAddress).approve(SYNTHETIX_CORE, 0);

            unchecked {
                ++i;
            }
        }
        delete globalMarginConfig.supportedCollaterals;

        // Update with passed in configuration.
        address[] memory newSupportedCollaterals = new address[](runtime.lengthAfter);
        for (uint256 i = 0; i < runtime.lengthAfter; ) {
            address collateralAddress = collateralAddresses[i];
            // Perform approve _once_ when this collateral is added as a supported collateral.
            ITokenModule(collateralAddress).approve(SYNTHETIX_CORE, runtime.maxApproveAmount);
            // sUSD must have a 0x0 reward distributor.
            address distributor = rewardDistributors[i];

            if (collateralAddress == SYNTHETIX_SUSD) {
                if (distributor != address(0)) {
                    revert ErrorUtil.InvalidRewardDistributor(distributor);
                }
            } else {
                // non-sUSD collateral must have a compatible reward distributor.
                //
                // NOTE: The comparison with `IRewardDistributor` here and not `IPerpRewardDistributor`.
                if (
                    !ERC165Helper.safeSupportsInterface(
                        distributor,
                        type(IRewardDistributor).interfaceId
                    )
                ) {
                    revert ErrorUtil.InvalidRewardDistributor(distributor);
                }
            }
            globalMarginConfig.supported[collateralAddress] = Margin.CollateralType(
                oracleNodeIds[i],
                maxAllowables[i],
                skewScales[i],
                rewardDistributors[i],
                true
            );
            newSupportedCollaterals[i] = collateralAddress;

            unchecked {
                ++i;
            }
        }
        globalMarginConfig.supportedCollaterals = newSupportedCollaterals;

        for (uint256 i = 0; i < runtime.lengthBefore; ) {
            address collateral = runtime.previousSupportedCollaterals[i];

            // Removing a collateral with a non-zero deposit amount is _not_ allowed. To wind down a collateral,
            // the market owner can set `maxAllowable=0` to disable deposits but to ensure traders can always withdraw
            // their deposited collateral, we cannot remove the collateral if deposits still remain.
            if (
                isCollateralDeposited(collateral) &&
                !globalMarginConfig.supported[collateral].exists
            ) {
                revert ErrorUtil.MissingRequiredCollateral(collateral);
            }

            unchecked {
                ++i;
            }
        }

        emit MarginCollateralConfigured(ERC2771Context._msgSender(), runtime.lengthAfter);
    }

    /// @inheritdoc IMarginModule
    function payDebt(uint128 accountId, uint128 marketId, uint128 amount) external {
        FeatureFlag.ensureAccessToFeature(Flags.PAY_DEBT);
        if (amount == 0) {
            revert ErrorUtil.ZeroAmount();
        }

        Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._PERPS_MODIFY_COLLATERAL_PERMISSION
        );

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        // We're storing debt separately to track the current debt before we pay down.
        uint128 debt = accountMargin.debtUsd;
        if (debt == 0) {
            revert ErrorUtil.NoDebt();
        }
        uint128 decreaseDebtAmount = MathUtil.min(amount, debt).to128();

        uint128 availableSusd = accountMargin.collaterals[SYNTHETIX_SUSD].to128();

        // Infer the amount of sUSD to deduct from margin.
        uint128 sUsdToDeduct = 0;
        if (availableSusd != 0) {
            sUsdToDeduct = MathUtil.min(decreaseDebtAmount, availableSusd).to128();
            accountMargin.collaterals[SYNTHETIX_SUSD] -= sUsdToDeduct;
        }

        // Perform account and margin debt updates.
        accountMargin.debtUsd -= decreaseDebtAmount;
        market.updateDebtAndCollateral(
            -decreaseDebtAmount.toInt(),
            -sUsdToDeduct.toInt(),
            SYNTHETIX_SUSD
        );

        // Infer the remaining sUSD to burn from `ERC2771Context._msgSender()` after attributing sUSD in margin.
        uint128 amountToBurn = decreaseDebtAmount - sUsdToDeduct;
        if (amountToBurn > 0) {
            ISynthetixSystem(SYNTHETIX_CORE).depositMarketUsd(
                marketId,
                ERC2771Context._msgSender(),
                amountToBurn
            );
        }

        emit DebtPaid(accountId, marketId, debt, accountMargin.debtUsd, sUsdToDeduct);
    }

    // --- Views --- //

    /// @inheritdoc IMarginModule
    function getMarginCollateralConfiguration()
        external
        view
        returns (ConfiguredCollateral[] memory)
    {
        Margin.GlobalData storage globalMarginConfig = Margin.load();

        uint256 length = globalMarginConfig.supportedCollaterals.length;
        MarginModule.ConfiguredCollateral[] memory collaterals = new ConfiguredCollateral[](length);
        address collateralAddress;

        for (uint256 i = 0; i < length; ) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            Margin.CollateralType storage c = globalMarginConfig.supported[collateralAddress];
            collaterals[i] = ConfiguredCollateral(
                collateralAddress,
                c.oracleNodeId,
                c.maxAllowable,
                c.skewScale,
                c.rewardDistributor
            );

            unchecked {
                ++i;
            }
        }

        return collaterals;
    }

    /// @inheritdoc IMarginModule
    function getMarginDigest(
        uint128 accountId,
        uint128 marketId
    ) external view returns (Margin.MarginValues memory) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        return Margin.getMarginUsd(accountId, market, market.getOraclePrice(addresses), addresses);
    }

    /// @inheritdoc IMarginModule
    function getNetAssetValue(
        uint128 accountId,
        uint128 marketId,
        uint256 oraclePrice
    ) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        return
            Margin.getNetAssetValue(
                accountId,
                market,
                oraclePrice == 0 ? market.getOraclePrice(addresses) : oraclePrice,
                addresses
            );
    }

    /// @inheritdoc IMarginModule
    function getDiscountedCollateralPrice(
        address collateralAddress,
        uint256 amount
    ) external view returns (uint256) {
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.GlobalData storage globalMarketConfig = PerpMarketConfiguration
            .load();
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        return
            Margin.getDiscountedCollateralPrice(
                amount,
                globalMarginConfig.getCollateralPrice(collateralAddress, addresses),
                collateralAddress,
                globalMarketConfig,
                globalMarginConfig,
                addresses
            );
    }

    /// @dev Internal function for this module to reduce code duplication when querying for margin liq reward.
    function _getMarginLiquidationOnlyReward(
        uint128 accountId,
        uint128 marketId,
        AddressRegistry.Data memory addresses
    ) internal view returns (uint256) {
        return
            Margin.getMarginLiquidationOnlyReward(
                Margin.getCollateralUsdWithoutDiscount(
                    Margin.load(accountId, marketId),
                    Margin.load(),
                    addresses
                ),
                PerpMarketConfiguration.load(marketId),
                PerpMarketConfiguration.load(),
                addresses
            );
    }

    /// @inheritdoc IMarginModule
    function getWithdrawableMargin(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        uint256 oraclePrice = market.getOraclePrice(addresses);
        Margin.MarginValues memory marginValues = Margin.getMarginUsd(
            accountId,
            market,
            oraclePrice,
            addresses
        );
        Position.Data storage position = market.positions[accountId];
        int128 size = position.size;

        // When there is no position then we can ignore all running losses/profits but still need to include debt
        // as they may have realized a prior negative PnL.
        if (size == 0) {
            int256 liqOnlyReward = _getMarginLiquidationOnlyReward(accountId, marketId, addresses)
                .toInt();
            return
                MathUtil
                    .max(
                        marginValues.collateralUsd.toInt() -
                            Margin.load(accountId, marketId).debtUsd.toInt() -
                            liqOnlyReward,
                        0
                    )
                    .toUint();
        }

        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (uint256 im, ) = Position.getLiquidationMarginUsd(
            size,
            oraclePrice,
            marginValues.collateralUsd,
            marketConfig,
            addresses
        );

        // There is a position open. Discount the collateral, deduct running losses (or add profits), reduce
        // by the IM as well as the liq and flag fee for an approximate withdrawable margin. We call this approx
        // because both the liq and flag rewards can change based on chain usage.
        return MathUtil.max(marginValues.discountedMarginUsd.toInt() - im.toInt(), 0).toUint();
    }

    /// @inheritdoc IMarginModule
    function getMarginLiquidationOnlyReward(
        uint128 accountId,
        uint128 marketId
    ) external view returns (uint256) {
        Account.exists(accountId);
        PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        return _getMarginLiquidationOnlyReward(accountId, marketId, addresses);
    }
}
