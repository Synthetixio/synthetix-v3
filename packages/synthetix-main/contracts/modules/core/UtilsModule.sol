//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";

import "../../interfaces/IUtilsModule.sol";

//
contract UtilsModule is IUtilsModule {
    using AssociatedSystem for AssociatedSystem.Data;

    bytes32 private constant _SYSTEM_TOKEN = "SNXToken";

    function mintInitialSystemToken(address to, uint amount) external override {
        OwnableStorage.onlyOwner();
        ITokenModule systemToken = AssociatedSystem.load(_SYSTEM_TOKEN).asToken();

        if (systemToken.totalSupply() != 0) {
            revert InitError.AlreadyInitialized();
        }

        systemToken.mint(to, amount);
    }
}
