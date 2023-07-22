//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {PerpMarketConfiguration} from "../storage/PerpMarketConfiguration.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import {IPyth} from "../external/pyth/IPyth.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import "../interfaces/IPerpMarketFactoryModule.sol";

contract PerpMarketFactoryModule is IPerpMarketFactoryModule {
    // --- Events --- //

    event MarketCreated(uint128 id, bytes32 name);

    // TODO: Add more views/events based on v2x events feedback (see Notion).

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function setSynthetix(ISynthetixSystem synthetix) external {
        OwnableStorage.onlyOwner();
        PerpMarketConfiguration.GlobalData storage globalConfig = PerpMarketConfiguration.load();

        globalConfig.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        globalConfig.snxUsdToken = ITokenModule(usdTokenAddress);
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
    function name(uint128 id) external view override returns (string memory) {
        return string(abi.encodePacked("Market ", PerpMarket.load(id).name)); // e.g. "Market wstETHPERP"
    }

    /**
     * @inheritdoc IMarket
     */
    function reportedDebt(uint128) external pure override returns (uint256) {
        return 0;
    }

    /**
     * @inheritdoc IMarket
     */
    function minimumCredit(uint128 _marketId) external view override returns (uint256) {
        // TODO: Get size of market then multiply by some percentage for a min amount;
        return 0;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IMarket).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
