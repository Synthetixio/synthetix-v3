//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SafeCastI256, SafeCastU256, SafeCastU128, SafeCastI128} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {IPyth} from "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../external/ISpotMarketSystem.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {IPerpMarketFactoryModule, IMarket} from "../interfaces/IPerpMarketFactoryModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";

contract PerpMarketFactoryModule is IPerpMarketFactoryModule {
    using DecimalMath for int128;
    using DecimalMath for uint128;
    using DecimalMath for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using SafeCastU128 for uint128;
    using PerpMarket for PerpMarket.Data;

    // --- Mutations --- //

    /// @inheritdoc IPerpMarketFactoryModule
    function setSynthetix(ISynthetixSystem synthetix) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        globalConfig.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        globalConfig.usdToken = ITokenModule(usdTokenAddress);
        globalConfig.oracleManager = synthetix.getOracleManager();
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function setSpotMarket(ISpotMarketSystem spotMarket) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.load().spotMarket = spotMarket;
    }

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

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        uint128 id = globalConfig.synthetix.registerMarket(address(this));

        PerpMarket.create(id, data.name);
        PerpMarket.load().activeMarketIds.push(id);
        emit MarketCreated(id, data.name);

        return id;
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function recomputeUtilization(uint128 marketId) external {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        (uint256 utilizationRate, ) = market.recomputeUtilization(market.getOraclePrice());
        emit UtilizationRecomputed(marketId, market.skew, utilizationRate);
    }

    /// @inheritdoc IPerpMarketFactoryModule
    function recomputeFunding(uint128 marketId) external {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        (int256 fundingRate, ) = market.recomputeFunding(market.getOraclePrice());
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
        uint256 totalCollateralValueUsd = market.getTotalCollateralValueUsd();

        int128 skew = market.skew;
        if (skew == 0) {
            return
                MathUtil
                    .max(
                        totalCollateralValueUsd.toInt() -
                            market.debtCorrection -
                            market.totalTraderDebtUsd.toInt(),
                        0
                    )
                    .toUint();
        }

        uint256 oraclePrice = market.getOraclePrice();
        (, int256 unrecordedFunding) = market.getUnrecordedFundingWithRate(oraclePrice);
        int256 priceWithFunding = oraclePrice.toInt() + unrecordedFunding;
        int256 marketReportedDebt = totalCollateralValueUsd.toInt() +
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
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        return
            market.size.mulDecimal(market.getOraclePrice()).mulDecimal(
                marketConfig.minCreditPercent
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
    function getMarketDigest(
        uint128 marketId
    ) external view returns (IPerpMarketFactoryModule.MarketDigest memory) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (, uint128 remainingCapacity, uint128 lastLiquidationTime) = market
            .getRemainingLiquidatableSizeCapacity(marketConfig);

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        IPerpMarketFactoryModule.DepositedCollateral[]
            memory depositedCollaterals = new DepositedCollateral[](length);
        uint128 synthMarketId;

        for (uint256 i = 0; i < length; ) {
            synthMarketId = globalMarginConfig.supportedSynthMarketIds[i];
            depositedCollaterals[i] = IPerpMarketFactoryModule.DepositedCollateral(
                synthMarketId,
                market.depositedCollateral[synthMarketId]
            );

            unchecked {
                ++i;
            }
        }

        return
            IPerpMarketFactoryModule.MarketDigest(
                depositedCollaterals,
                market.name,
                market.skew,
                market.size,
                market.getOraclePrice(),
                market.getCurrentFundingVelocity(),
                market.getCurrentFundingRate(),
                market.currentUtilizationRateComputed,
                remainingCapacity,
                lastLiquidationTime,
                market.totalTraderDebtUsd,
                market.getTotalCollateralValueUsd(),
                market.debtCorrection
            );
    }
}
