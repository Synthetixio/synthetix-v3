//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IDebtShare.sol";

contract SpartanCouncilStorage {
    struct SpartanCouncilStore {
        IDebtShare debtShareContract;
        mapping(uint => uint128) debtShareIds;
    }

    function _spartanCouncilStore() internal pure returns (SpartanCouncilStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.spartancouncil")) - 1)
            store.slot := 0xe62e721e927937c7cbecbfc40678c6b9195b7d4bf60f20fbb2fc5b21cbe77c38
        }
    }
}
