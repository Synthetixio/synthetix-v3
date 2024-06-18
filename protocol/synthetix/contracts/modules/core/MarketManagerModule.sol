//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IMarketManagerModule.sol";
import "../../interfaces/IUSDTokenModule.sol";
import "../../interfaces/external/IMarket.sol";

import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../storage/Config.sol";
import "../../storage/Market.sol";
import "../../storage/MarketCreator.sol";
import "../../storage/Distribution.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";

/**
 * @title System-wide entry point for the management of markets connected to the system.
 * @dev See IMarketManagerModule.
 */
contract MarketManagerModule is IMarketManagerModule {
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using Market for Market.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using Distribution for Distribution.Data;
    using HeapUtil for HeapUtil.Data;

    using DecimalMath for uint256;

    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _MARKET_FEATURE_FLAG = "registerMarket";
    bytes32 private constant _DEPOSIT_MARKET_FEATURE_FLAG = "depositMarketUsd";
    bytes32 private constant _WITHDRAW_MARKET_FEATURE_FLAG = "withdrawMarketUsd";

    bytes32 private constant _CONFIG_SET_MARKET_MIN_DELEGATE_MAX = "setMarketMinDelegateTime_max";
    bytes32 private constant _CONFIG_DEPOSIT_MARKET_USD_FEE_RATIO = "depositMarketUsd_feeRatio";
    bytes32 private constant _CONFIG_WITHDRAW_MARKET_USD_FEE_RATIO = "withdrawMarketUsd_feeRatio";
    bytes32 private constant _CONFIG_DEPOSIT_MARKET_USD_FEE_ADDRESS = "depositMarketUsd_feeAddress";
    bytes32 private constant _CONFIG_WITHDRAW_MARKET_USD_FEE_ADDRESS =
        "withdrawMarketUsd_feeAddress";

    /**
     * @inheritdoc IMarketManagerModule
     */
    function registerMarket(address market) external override returns (uint128 marketId) {
        FeatureFlag.ensureAccessToFeature(_MARKET_FEATURE_FLAG);

        if (!ERC165Helper.safeSupportsInterface(market, type(IMarket).interfaceId)) {
            revert IncorrectMarketInterface(market);
        }

        marketId = MarketCreator.create(market).id;

        emit MarketRegistered(market, marketId, ERC2771Context._msgSender());

        return marketId;
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getWithdrawableMarketUsd(uint128 marketId) public view override returns (uint256) {
        int256 withdrawable = Market.load(marketId).creditCapacityD18 +
            Market.load(marketId).getDepositedCollateralValue().toInt();

        return withdrawable < 0 ? 0 : withdrawable.toUint();
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketAddress(uint128 marketId) external view override returns (address) {
        return Market.load(marketId).marketAddress;
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketNetIssuance(uint128 marketId) external view override returns (int128) {
        return Market.load(marketId).netIssuanceD18;
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketReportedDebt(uint128 marketId) external view override returns (uint256) {
        return Market.load(marketId).getReportedDebt();
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketCollateral(uint128 marketId) external view override returns (uint256) {
        return Market.load(marketId).poolsDebtDistribution.totalSharesD18;
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketTotalDebt(uint128 marketId) external view override returns (int256) {
        return Market.load(marketId).totalDebt();
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketDebtPerShare(uint128 marketId) external override returns (int256) {
        Market.Data storage market = Market.load(marketId);

        market.distributeDebtToPools(999999999);

        return market.getDebtPerShare();
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketPools(
        uint128 marketId
    )
        external
        override
        returns (uint128[] memory inRangePoolIds, uint128[] memory outRangePoolIds)
    {
        Market.Data storage market = Market.load(marketId);
        market.distributeDebtToPools(999999999);

        HeapUtil.Data storage inRangePools = market.inRangePools;
        inRangePoolIds = new uint128[](inRangePools.size());
        for (uint256 i = 1; i <= inRangePools.size(); i++) {
            HeapUtil.Node memory node = inRangePools.getByIndex(i);
            inRangePoolIds[i - 1] = node.id;
        }

        HeapUtil.Data storage outRangePools = market.outRangePools;
        outRangePoolIds = new uint128[](outRangePools.size());
        for (uint256 i = 1; i <= outRangePools.size(); i++) {
            HeapUtil.Node memory node = outRangePools.getByIndex(i);
            outRangePoolIds[i - 1] = node.id;
        }
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketPoolDebtDistribution(
        uint128 marketId,
        uint128 poolId
    )
        external
        override
        returns (uint256 sharesD18, uint128 totalSharesD18, int128 valuePerShareD27)
    {
        Market.Data storage market = Market.load(marketId);
        market.distributeDebtToPools(999999999);

        Distribution.Data storage poolDistribution = market.poolsDebtDistribution;
        sharesD18 = poolDistribution.getActorShares(poolId.toBytes32());

        totalSharesD18 = market.poolsDebtDistribution.totalSharesD18;
        valuePerShareD27 = market.poolsDebtDistribution.valuePerShareD27;
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function isMarketCapacityLocked(uint128 marketId) external view override returns (bool) {
        return Market.load(marketId).isCapacityLocked();
    }

    function getUsdToken() external view override returns (IERC20) {
        return AssociatedSystem.load(_USD_TOKEN).asToken();
    }

    function getOracleManager() external view returns (IOracleManager) {
        return IOracleManager(OracleManager.load().oracleManagerAddress);
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint256 amount
    ) external override returns (uint256 feeAmount) {
        FeatureFlag.ensureAccessToFeature(_DEPOSIT_MARKET_FEATURE_FLAG);
        Market.Data storage market = Market.load(marketId);

        // Call must come from the market itself.
        if (ERC2771Context._msgSender() != market.marketAddress)
            revert AccessError.Unauthorized(ERC2771Context._msgSender());

        feeAmount = amount.mulDecimal(Config.readUint(_CONFIG_DEPOSIT_MARKET_USD_FEE_RATIO, 0));
        address feeAddress = address(0);
        address configFeeAddress = Config.readAddress(
            _CONFIG_DEPOSIT_MARKET_USD_FEE_ADDRESS,
            address(0)
        );

        if (feeAmount > 0 && configFeeAddress != address(0)) {
            feeAddress = configFeeAddress;
        }
        // verify if the market is authorized to burn the USD for the target
        ITokenModule usdToken = AssociatedSystem.load(_USD_TOKEN).asToken();

        // Adjust accounting.
        market.creditCapacityD18 += (amount - feeAmount).toInt().to128();
        market.netIssuanceD18 -= (amount - feeAmount).toInt().to128();

        // Burn the incoming USD.
        // Note: Instead of burning, we could transfer USD to and from the MarketManager,
        // but minting and burning takes the USD out of circulation,
        // which doesn't affect `totalSupply`, thus simplifying accounting.
        IUSDTokenModule(address(usdToken)).burnWithAllowance(
            target,
            ERC2771Context._msgSender(),
            amount
        );

        if (feeAmount > 0 && feeAddress != address(0)) {
            IUSDTokenModule(address(usdToken)).mint(feeAddress, feeAmount);

            emit MarketSystemFeePaid(marketId, feeAmount);
        }

        emit MarketUsdDeposited(
            marketId,
            target,
            amount,
            ERC2771Context._msgSender(),
            market.creditCapacityD18,
            market.netIssuanceD18,
            market.getDepositedCollateralValue()
        );
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint256 amount
    ) external override returns (uint256 feeAmount) {
        FeatureFlag.ensureAccessToFeature(_WITHDRAW_MARKET_FEATURE_FLAG);
        Market.Data storage marketData = Market.load(marketId);

        // Call must come from the market itself.
        if (ERC2771Context._msgSender() != marketData.marketAddress)
            revert AccessError.Unauthorized(ERC2771Context._msgSender());

        // Ensure that the market's balance allows for this withdrawal.
        feeAmount = amount.mulDecimal(Config.readUint(_CONFIG_WITHDRAW_MARKET_USD_FEE_RATIO, 0));
        if (amount + feeAmount > getWithdrawableMarketUsd(marketId))
            revert NotEnoughLiquidity(marketId, amount);

        address feeAddress = address(0);
        address configFeeAddress = Config.readAddress(
            _CONFIG_WITHDRAW_MARKET_USD_FEE_ADDRESS,
            address(0)
        );

        if (feeAmount > 0 && configFeeAddress != address(0)) {
            feeAddress = configFeeAddress;
        }

        // Adjust accounting.
        marketData.creditCapacityD18 -= (amount + feeAmount).toInt().to128();
        marketData.netIssuanceD18 += (amount + feeAmount).toInt().to128();

        // Mint the requested USD.
        AssociatedSystem.load(_USD_TOKEN).asToken().mint(target, amount);

        if (feeAmount > 0 && feeAddress != address(0)) {
            AssociatedSystem.load(_USD_TOKEN).asToken().mint(feeAddress, feeAmount);

            emit MarketSystemFeePaid(marketId, feeAmount);
        }

        emit MarketUsdWithdrawn(
            marketId,
            target,
            amount,
            ERC2771Context._msgSender(),
            marketData.creditCapacityD18,
            marketData.netIssuanceD18,
            marketData.getDepositedCollateralValue()
        );
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketFees(
        uint128,
        uint256 amount
    ) external view override returns (uint256 depositFeeAmount, uint256 withdrawFeeAmount) {
        depositFeeAmount = amount.mulDecimal(
            Config.readUint(_CONFIG_DEPOSIT_MARKET_USD_FEE_RATIO, 0)
        );

        withdrawFeeAmount = amount.mulDecimal(
            Config.readUint(_CONFIG_WITHDRAW_MARKET_USD_FEE_RATIO, 0)
        );
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function distributeDebtToPools(
        uint128 marketId,
        uint256 maxIter
    ) external override returns (bool) {
        return Market.load(marketId).distributeDebtToPools(maxIter);
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function setMarketMinDelegateTime(uint128 marketId, uint32 minDelegateTime) external override {
        Market.Data storage market = Market.load(marketId);

        if (ERC2771Context._msgSender() != market.marketAddress)
            revert AccessError.Unauthorized(ERC2771Context._msgSender());

        // min delegate time should not be unreasonably long
        uint256 maxMinDelegateTime = Config.readUint(
            _CONFIG_SET_MARKET_MIN_DELEGATE_MAX,
            86400 * 30
        );

        if (minDelegateTime > maxMinDelegateTime) {
            revert ParameterError.InvalidParameter("minDelegateTime", "must not be too large");
        }

        market.minDelegateTime = minDelegateTime;

        emit SetMinDelegateTime(marketId, minDelegateTime);
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMarketMinDelegateTime(uint128 marketId) external view override returns (uint32) {
        // solhint-disable-next-line numcast/safe-cast
        uint32 maxMinDelegateTime = uint32(
            Config.readUint(_CONFIG_SET_MARKET_MIN_DELEGATE_MAX, 86400 * 30)
        );
        uint32 marketMinDelegateTime = Market.load(marketId).minDelegateTime;
        return
            maxMinDelegateTime < marketMinDelegateTime ? maxMinDelegateTime : marketMinDelegateTime;
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function setMinLiquidityRatio(uint128 marketId, uint256 minLiquidityRatio) external override {
        OwnableStorage.onlyOwner();
        Market.Data storage market = Market.load(marketId);

        market.minLiquidityRatioD18 = minLiquidityRatio;

        emit SetMarketMinLiquidityRatio(marketId, minLiquidityRatio);
    }

    /**
     * @inheritdoc IMarketManagerModule
     */
    function getMinLiquidityRatio(uint128 marketId) external view override returns (uint256) {
        return Market.load(marketId).minLiquidityRatioD18;
    }
}
