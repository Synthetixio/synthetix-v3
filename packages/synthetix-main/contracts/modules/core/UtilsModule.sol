//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

import "@synthetixio/core-contracts/contracts/errors/InitError.sol";

import "../../interfaces/IUSDTokenModule.sol";

import "../../interfaces/IUtilsModule.sol";

//
contract UtilsModule is IUtilsModule {
    using AssociatedSystem for AssociatedSystem.Data;

    bytes32 private constant _SYSTEM_TOKEN = "SNXToken";
    bytes32 private constant _USD_TOKEN = "USDToken";

    bytes32 private constant _CCIP_CHAINLINK_SEND = "ccipChainlinkSend";
    bytes32 private constant _CCIP_CHAINLINK_RECV = "ccipChainlinkRecv";
    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";

    function mintInitialSystemToken(address to, uint amount) external override {
        OwnableStorage.onlyOwner();
        ITokenModule systemToken = AssociatedSystem.load(_SYSTEM_TOKEN).asToken();

        if (systemToken.totalSupply() != 0) {
            revert InitError.AlreadyInitialized();
        }

        systemToken.mint(to, amount);
    }

    function registerCcip(address ccipSend, address ccipReceive, address ccipTokenPool) external override {
        OwnableStorage.onlyOwner();
        
        IAssociatedSystemsModule usdToken = IAssociatedSystemsModule(AssociatedSystem.load(_USD_TOKEN).proxy);

        usdToken.registerUnmanagedSystem(_CCIP_CHAINLINK_SEND, ccipSend);
        usdToken.registerUnmanagedSystem(_CCIP_CHAINLINK_RECV, ccipReceive);
        usdToken.registerUnmanagedSystem(_CCIP_CHAINLINK_TOKEN_POOL, ccipTokenPool);
    }
}
