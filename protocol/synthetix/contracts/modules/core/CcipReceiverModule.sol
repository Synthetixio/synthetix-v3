//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/IAssociatedSystemsModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

import "../../interfaces/external/IAny2EVMMessageReceiver.sol";

import "../../storage/OracleManager.sol";
import "../../storage/Config.sol";
import "../../storage/CrossChain.sol";

/**
 * @title Module with assorted utility functions.
 * @dev See IUtilsModule.
 */
contract CcipReceiverModule is IAny2EVMMessageReceiver {
    function ccipReceive(CcipClient.Any2EVMMessage memory message) external {
        CrossChain.processCcipReceive(CrossChain.load(), message);
    }
}
