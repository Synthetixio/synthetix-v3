//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {IERC165} from "@synthetixio/core-contracts/contracts/interfaces/IERC165.sol";
import {PerpMarketFactoryConfiguration} from "../storage/PerpMarketFactoryConfiguration.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";
import "../interfaces/IPerpMarketFactoryModule.sol";

contract PerpMarketFactoryModule is IPerpMarketFactoryModule {
    uint128 public marketId;

    /**
     * @inheritdoc IPerpMarketFactoryModule
     */
    function setSynthetix(ISynthetixSystem synthetix) external {
        OwnableStorage.onlyOwner();
        PerpMarketFactoryConfiguration.Data storage store = PerpMarketFactoryConfiguration.load();

        store.synthetix = synthetix;
        (address usdTokenAddress, ) = synthetix.getAssociatedSystem("USDToken");
        store.snxUsdToken = ITokenModule(usdTokenAddress);
        store.oracleManager = synthetix.getOracleManager();
    }

    // --- Required functions to be IMarket compatiable --- //

    /**
     * @inheritdoc IMarket
     */
    function name(uint128 _marketId) external view override returns (string memory n) {
        if (_marketId == marketId) {
            n = string(abi.encodePacked("Market ", bytes32(uint256(_marketId))));
        }
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
        return 0;
    }

    /**
     * @inheritdoc IERC165
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(IERC165) returns (bool) {
        return interfaceId == type(IMarket).interfaceId || interfaceId == this.supportsInterface.selector;
    }
}
