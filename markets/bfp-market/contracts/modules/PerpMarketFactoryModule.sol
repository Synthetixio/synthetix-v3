//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Margin} from "../storage/Margin.sol";
import {AddressRegistry} from "../storage/AddressRegistry.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {IPerpMarketFactoryModule, IMarket} from "../interfaces/IPerpMarketFactoryModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import {ErrorUtil} from "../utils/ErrorUtil.sol";

contract PerpMarketFactoryModule is IPerpMarketFactoryModule {
    using DecimalMath for int128;
    using DecimalMath for uint128;
    using DecimalMath for uint256;
    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;

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

    // --- Mutations --- //

    /// @inheritdoc IPerpMarketFactoryModule
    function setPyth(IPyth pyth) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.load().pyth = pyth;
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function setEthOracleNodeId(bytes32 ethOracleNodeId) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.load().ethOracleNodeId = ethOracleNodeId;
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function setRewardDistributorImplementation(address implementation) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.load().rewardDistributorImplementation = implementation;
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function createMarket(
        IPerpMarketFactoryModule.CreatePerpMarketParameters memory data
    ) external returns (uint128) {
        OwnableStorage.onlyOwner();

        uint128 id = ISynthetixSystem(SYNTHETIX_CORE).registerMarket(address(this));

        PerpMarket.create(id, data.name);
        PerpMarket.load().activeMarketIds.push(id);
        emit MarketCreated(id, data.name);

        return id;
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function recomputeUtilization(uint128 marketId) external {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        (uint128 utilizationRate, ) = market.recomputeUtilization(
            market.getOraclePrice(addresses),
            addresses
        );
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function recomputeFunding(uint128 marketId) external {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        (int128 fundingRate, ) = market.recomputeFunding(
            market.getOraclePrice(
                AddressRegistry.Data({
                    synthetix: ISynthetixSystem(SYNTHETIX_CORE),
                    sUsd: SYNTHETIX_SUSD,
                    oracleManager: ORACLE_MANAGER
                })
            )
        );
        emit FundingRecomputed(
            marketId,
            market.skew,
            fundingRate,
            market.getCurrentFundingVelocity()
        );
    }

    /// @inheritdoc IMarket
    function name(uint128) external pure override returns (string memory) {
        return "BFP Market";
    }

    /// @inheritdoc IMarket
    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        int256 totalCollateralValueUsd = market.getTotalCollateralValueUsd(addresses).toInt();
        int128 skew = market.skew;
        int256 marketReportedDebt;

        if (skew == 0) {
            marketReportedDebt =
                totalCollateralValueUsd -
                market.debtCorrection -
                market.totalTraderDebtUsd.toInt();
            return MathUtil.max(marketReportedDebt, 0).toUint();
        }

        uint256 oraclePrice = market.getOraclePrice(addresses);
        (, int128 unrecordedFunding) = market.getUnrecordedFundingWithRate(oraclePrice);
        int128 nextFundingAccrued = market.currentFundingAccruedComputed + unrecordedFunding;
        int256 priceWithFunding = oraclePrice.toInt() + nextFundingAccrued;

        marketReportedDebt =
            totalCollateralValueUsd +
            skew.mulDecimal(priceWithFunding) -
            market.debtCorrection -
            market.totalTraderDebtUsd.toInt();

        return MathUtil.max(marketReportedDebt, 0).toUint();
    }

    /// @inheritdoc IMarket
    function minimumCredit(uint128 marketId) external view override returns (uint256) {
        // Intuition for `market.size * price * ratio` is if all positions were to be closed immediately,
        // how much credit would this market need in order to pay out traders. The `ratio` is there simply as a
        // risk parameter to increase (or decrease) the min req credit needed to safely operate the market.
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        return
            market.getMinimumCredit(
                PerpMarketConfiguration.load(marketId),
                market.getOraclePrice(addresses),
                addresses
            );
    }

    /// @inheritdoc IERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }

    // --- Views --- //

    /// @inheritdoc IPerpMarketFactoryModule
    function getActiveMarketIds() external view returns (uint128[] memory) {
        return PerpMarket.load().activeMarketIds;
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function getUtilizationDigest(
        uint128 marketId
    ) external view returns (IPerpMarketFactoryModule.UtilizationDigest memory) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });
        uint128 utilization = market.getUtilization(market.getOraclePrice(addresses), addresses);
        return
            IPerpMarketFactoryModule.UtilizationDigest(
                market.currentUtilizationRateComputed,
                market.lastUtilizationTime,
                PerpMarket.getCurrentUtilizationRate(utilization, globalConfig),
                utilization
            );
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function getMarketDigest(
        uint128 marketId
    ) external view returns (IPerpMarketFactoryModule.MarketDigest memory) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (, uint128 remainingCapacity, uint128 lastLiquidationTime) = market
            .getRemainingLiquidatableSizeCapacity(marketConfig);

        uint256 length = globalMarginConfig.supportedCollaterals.length;
        IPerpMarketFactoryModule.DepositedCollateral[]
            memory depositedCollaterals = new DepositedCollateral[](length);
        address collateralAddress;

        for (uint256 i = 0; i < length; ) {
            collateralAddress = globalMarginConfig.supportedCollaterals[i];
            depositedCollaterals[i] = IPerpMarketFactoryModule.DepositedCollateral(
                collateralAddress,
                market.depositedCollateral[collateralAddress]
            );

            unchecked {
                ++i;
            }
        }
        AddressRegistry.Data memory addresses = AddressRegistry.Data({
            synthetix: ISynthetixSystem(SYNTHETIX_CORE),
            sUsd: SYNTHETIX_SUSD,
            oracleManager: ORACLE_MANAGER
        });

        return
            IPerpMarketFactoryModule.MarketDigest(
                depositedCollaterals,
                market.name,
                market.skew,
                market.size,
                market.getOraclePrice(addresses),
                market.getCurrentFundingVelocity(),
                market.getCurrentFundingRate(),
                market.currentUtilizationRateComputed,
                remainingCapacity,
                lastLiquidationTime,
                market.totalTraderDebtUsd,
                market.getTotalCollateralValueUsd(addresses),
                market.debtCorrection
            );
    }
}
