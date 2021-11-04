//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../proxy/UUPSImplementation.sol";

contract ImplementationMockStorage {
    struct ImplementationMockNamespace {
        uint a;
    }

    function _implementationMockStorage() internal pure returns (ImplementationMockNamespace storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.v3.core-contracts.proxyimplementation")) - 1)
            store.slot := 0xd2adbc3c9c4f8d59de43697ca626553b287f0ffd89301738d2b2d6ae3172b7f7
        }
    }
}

contract UUPSImplementationMockA is UUPSImplementation, ImplementationMockStorage {
    function setA(uint newA) external {
        _implementationMockStorage().a = newA;
    }

    function getA() external view returns (uint) {
        return _implementationMockStorage().a;
    }
}
