//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/**
 * @title Async order top level data storage
 */
library Policy {
    struct Data {
        // ERC721 token id which can claim this policy
        uint128 beneficiary;

        // Maximum USD which can be claimed from this policy
        uint128 maxAmount;

        // When the policy is no longer valid
        uint64 expiresAt;
    }

    function load(uint128 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.insurance-market.Policy", id));
        assembly {
            store.slot := s
        }
    }

    function create(Data memory newPolicy) internal returns (Data storage storedPolicy) {
        storedPolicy = load(newPolicy.beneficiary);

        storedPolicy.beneficiary = newPolicy.beneficiary;
        storedPolicy.maxAmount = newPolicy.maxAmount;
        storedPolicy.expiresAt = newPolicy.expiresAt;
    }
}
