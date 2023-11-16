//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {NftModule} from "@synthetixio/core-modules/contracts/modules/NftModule.sol";
import {ICouncilTokenModule} from "../../interfaces/ICouncilTokenModule.sol";

/* solhint-disable no-empty-blocks */
/**
 * @title Module with custom NFT logic for the account token.
 * @dev See IAccountTokenModule.
 */
// solhint-disable-next-line no-empty-blocks
contract CouncilTokenModule is ICouncilTokenModule, NftModule {
    error NotImplemented();

    function _transfer(address, address, uint256) internal pure override {
        revert NotImplemented();
    }
}
/* solhint-enable no-empty-blocks */
