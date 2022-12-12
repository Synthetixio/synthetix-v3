//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ExampleContract {
    enum NodeType {
        NONE,
        REDUCER,
        EXTERNAL,
        CHAINLINK,
        PYTH
    }

    struct Data {
        address owner;
        mapping(address => uint128) permissions;
        NodeType nodeType;
    }

    uint128 public constant SOME_CONSTANT = 445;
    uint128 public constant SOME_CASTED_CONSTANT = uint128(SOME_CONSTANT);
    address private constant SOME_ADDRESS = 0xe27454c382e79a1876096B691ef4b52747B7097D;

    uint256 public stateVariableNumber = 12345;
    string public stateVariableString = "give me some testing data";

    function getValue() public pure returns (uint256) {
        return 1;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("ExampleContract"));
        assembly {
            store.slot := s
        }
    }
}
