//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {SafeCastI256, SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../external/ISpotMarketSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {Margin} from "../storage/Margin.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {IPerpMarketFactoryModule, IMarket} from "../interfaces/IPerpMarketFactoryModule.sol";
import {MathUtil} from "../utils/MathUtil.sol";

contract PerpMarketFactoryModule is IPerpMarketFactoryModule {
    using DecimalMath for int128;
    using DecimalMath for uint128;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;
    using PerpMarket for PerpMarket.Data;

    // --- Mutative --- //

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function setSynthetix(ISynthetixSystem synthetix) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        globalConfig.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        globalConfig.usdToken = ITokenModule(usdTokenAddress);
        globalConfig.oracleManager = synthetix.getOracleManager();
    }

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function setSpotMarket(ISpotMarketSystem spotMarket) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        globalConfig.spotMarket = spotMarket;
    }

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function setPyth(IPyth pyth) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        globalConfig.pyth = pyth;
    }

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function setEthOracleNodeId(bytes32 ethOracleNodeId) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        globalConfig.ethOracleNodeId = ethOracleNodeId;
    }

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function createMarket(IPerpMarketFactoryModule.CreatePerpMarketParameters memory data) external returns (uint128) {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        uint128 id = globalConfig.synthetix.registerMarket(address(this));

        PerpMarket.create(id, data.name);
        emit MarketCreated(id, data.name);

        return id;
    }

    // --- Required functions to be IMarket compatible --- //

    /**
     * @inheritdoc IMarket
     */
    function name(uint128) external pure override returns (string memory) {
        return "BFP Market";
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        uint256 totalCollateralValueUsd = market.getTotalCollateralValueUsd();

        if (market.skew == 0 && market.debtCorrection == 0) {
            return totalCollateralValueUsd;
        }

        uint256 oraclePrice = market.getOraclePrice();
        (, int256 unrecordedFunding) = market.getUnrecordedFundingWithRate(oraclePrice);
        int256 priceWithFunding = int(oraclePrice) + unrecordedFunding;
        int256 marketReportedDebt = totalCollateralValueUsd.toInt() +
            market.skew.mulDecimal(priceWithFunding) -
            market.debtCorrection;

        return MathUtil.max(marketReportedDebt, 0).toUint();
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(uint128 marketId) external view override returns (uint256) {
        // Intuition for `market.size * price * ratio` is if all positions were to be closed immediately,
        // how much credit would this market need in order to pay out traders. The `ratio` is there simply as a
        // risk parameter to increase (or decrease) the min req credit needed to safely operate the market.
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        return market.size.mulDecimal(market.getOraclePrice()).mulDecimal(marketConfig.minCreditPercent);
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IMarket).interfaceId || interfaceId == this.supportsInterface.selector;
    }

    // --- Views --- //

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function getMarketDigest(uint128 marketId) external view returns (IPerpMarketFactoryModule.MarketDigest memory) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.GlobalData storage globalMarginConfig = Margin.load();
        PerpMarketConfiguration.Data storage marketConfig = PerpMarketConfiguration.load(marketId);
        (, uint128 remainingCapacity, uint128 lastLiquidationTime) = market.getRemainingLiquidatableSizeCapacity(
            marketConfig
        );

        uint256 length = globalMarginConfig.supportedSynthMarketIds.length;
        IPerpMarketFactoryModule.DepositedCollateral[] memory depositedCollaterals = new DepositedCollateral[](length);
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
                remainingCapacity,
                lastLiquidationTime,
                market.getTotalCollateralValueUsd(),
                market.debtCorrection
            );
    }
}
