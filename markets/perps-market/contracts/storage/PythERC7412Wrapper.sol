//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/oracle-manager/contracts/interfaces/external/IPyth.sol";

/**
 * @title PythERC7412Wrapper data
 */
library PythERC7412Wrapper {
    bytes32 private constant _SLOT_ERC7412_WRAPPER =
        keccak256(abi.encode("io.synthetix.PythERC7412Wrapper"));

    struct Data {
        /**
         * @dev The pyth contract address
         */
        address pythAddress;
        /**
         * @dev Bench mark prices for price ids
         */
        mapping(bytes32 => mapping(uint64 => PythStructs.Price)) benchmarkPrices;
    }

    /**
     * @dev Loads the singleton storage info about the Wrapper contract.
     */
    function load() internal pure returns (Data storage data) {
        bytes32 s = _SLOT_ERC7412_WRAPPER;
        assembly {
            data.slot := s
        }
    }
}
