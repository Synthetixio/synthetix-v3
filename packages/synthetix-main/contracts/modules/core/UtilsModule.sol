//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";

import "../../interfaces/IUtilsModule.sol";

//
contract UtilsModule is IUtilsModule, AssociatedSystemsMixin, OwnableMixin {
    bytes32 private constant _SYSTEM_TOKEN = "SNXToken";

    function mintInitialSystemToken(address to, uint amount) external override onlyOwner {
        ITokenModule systemToken = _getToken(_SYSTEM_TOKEN);

        if (systemToken.totalSupply() != 0) {
            revert InitError.AlreadyInitialized();
        }

        systemToken.mint(to, amount);
    }
}
