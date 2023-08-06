//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "../interfaces/IPerpMarketFactoryModule.sol";

contract PerpMarketFactoryModule is IPerpMarketFactoryModule {
    using DecimalMath for int128;
    using SafeCastI256 for int256;
    using PerpMarket for PerpMarket.Data;

    // --- Events --- //

    event MarketCreated(uint128 id, bytes32 name);

    // TODO: Add more views/events based on v2x events feedback (see Notion).
    //
    // - add getMarketDigest but perhaps in an MarketModule rather than the factory

    // TODO: Add ability to pause/close-only for markets.

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
    function createMarket(
        IPerpMarketFactoryModule.CreatePerpMarketParameters memory data
    ) external returns (uint128 id) {
        OwnableStorage.onlyOwner();

        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();
        id = globalConfig.synthetix.registerMarket(address(this));

        PerpMarket.create(id, data.name);
        emit MarketCreated(id, data.name);
    }

    // --- Required functions to be IMarket compatible --- //

    /**
     * @inheritdoc IMarket
     */
    function name(uint128 marketId) external view override returns (string memory) {
        return string(abi.encodePacked("Market ", PerpMarket.exists(marketId).name)); // e.g. "Market wstETHPERP"
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        if (market.skew == 0 && market.debtCorrection == 0) {
            return 0;
        }
        uint256 oraclePrice = market.getOraclePrice();
        int256 priceWithFunding = int(oraclePrice) + market.getNextFunding(oraclePrice);
        int256 totalDebt = market.skew.mulDecimal(priceWithFunding) + market.debtCorrection;
        return MathUtil.max(totalDebt, 0).toUint();
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(uint128 marketId) external view override returns (uint256) {
        // Intuition for `market.size * price * ratio` is if all positions were to be closed immediately,
        // how much credit would this market need in order to pay out traders. The `ratio` is there simply as a
        // risk parameter to increase (or decrease) the min req credit needed to safely operate the market.
        //
        // TODO: The ratio param lol. It should be defined at the market level.
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        return market.size * market.getOraclePrice();
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IMarket).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
