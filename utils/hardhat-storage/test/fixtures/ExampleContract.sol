//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

contract ExampleContract {
    bytes32 private constant _SLOT_EXAMPLE_CONTRACT =
        keccak256(abi.encode("io.synthetix.hardhat-storage.Example"));

    enum EnumExample {
        ONE,
        TWO,
        THREE,
        FOUR,
        FIVE
    }

    struct Data {
        address owner;
        EnumExample enumExample;
        mapping(address => uint128) simpleMapping;
        address[] dynamicArray;
        uint256[3] staticArray;
        uint uninsignedInt; // solhint-disable-line explicit-types
        uint256 uninsignedInt256;
        uint8 uninsignedInt8;
        int256 signedInt256;
    }

    uint128 public constant SOME_CONSTANT = 445;
    uint128 public constant SOME_CASTED_CONSTANT = uint128(SOME_CONSTANT); // solhint-disable-line numcast/safe-cast
    address private constant SOME_ADDRESS = 0xe27454c382e79a1876096B691ef4b52747B7097D;

    uint256 public stateVariableNumber = 12345;
    string public stateVariableString = "give me some testing data";

    function getValue() public pure returns (uint256) {
        return 1;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_EXAMPLE_CONTRACT;
        assembly {
            store.slot := s
        }
    }
}
