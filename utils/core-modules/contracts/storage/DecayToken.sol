//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library DecayToken {
    bytes32 private constant _SLOT_DECAY_TOKEN_STORAGE =
        keccak256(abi.encode("io.synthetix.core-modules.DecayToken"));

    struct Data {
        /**
         * @dev Annualized decay rate, expressed with 18 decimal precision (1e18 = 100%).
         */
        uint256 decayRate;
        /**
         * @dev Timestamp of the last mint or burn event.
         */
        uint256 epochStart;
        /**
         * @dev Total supply as of the last mint or burn event.
         */
        uint256 totalSupplyAtEpochStart;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_DECAY_TOKEN_STORAGE;
        assembly {
            store.slot := s
        }
    }
}
