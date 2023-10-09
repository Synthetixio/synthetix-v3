//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library ElectionCrossChainSettings {
    struct Data {
        address motherchainElectionModule;
    }

    function load() internal pure returns (Data storage settings) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.ElectionCrossChainSettings"));
        assembly {
            settings.slot := s
        }
    }

    function setMotherchainElectionModule(Data storage settings, address electionModule) internal {
        settings.motherchainElectionModule = electionModule;
    }

    function getMotherchainElectionModule(Data storage settings) internal view returns (address) {
        return settings.motherchainElectionModule;
    }
}
