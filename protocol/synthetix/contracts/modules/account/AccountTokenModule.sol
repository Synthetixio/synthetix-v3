//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/modules/NftModule.sol";
import "../../../contracts/interfaces/IAccountTokenModule.sol";
import "../../../contracts/interfaces/IAccountModule.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

/**
 * @title Module with custom NFT logic for the account token.
 * @dev See IAccountTokenModule.
 */
contract AccountTokenModule is IAccountTokenModule, NftModule {
    using SafeCastU256 for uint256;

    /**
     * @dev Updates account RBAC storage to track the current owner of the token.
     */
    function _postTransfer(
        address, // from (unused)
        address to,
        uint256 tokenId
    ) internal virtual override {
        IAccountModule(OwnableStorage.getOwner()).notifyAccountTransfer(to, tokenId.to128());
    }
}
