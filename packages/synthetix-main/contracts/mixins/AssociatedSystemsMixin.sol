//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";
import "@synthetixio/core-contracts/contracts/errors/InitError.sol";
import "../storage/AssociatedSystemsStorage.sol";
import "../interfaces/IUSDToken.sol";

contract AssociatedSystemsMixin is AssociatedSystemsStorage {
    function _getAssociatedToken(string memory symbol) internal view returns (IERC20) {
        return IERC20(_associatedSystemsStorage().tokens[symbol].proxy);
    }

    function _getAssociatedNft(string memory symbol) internal view returns (IERC721) {
        return IERC721(_associatedSystemsStorage().tokens[symbol].proxy);
    }

    modifier onlyIfTokenAssociated(string memory token) {
        if (address(_getAssociatedToken(token)) == address(0)) {
            revert InitError.NotInitialized();
        }

        _;
    }
}
