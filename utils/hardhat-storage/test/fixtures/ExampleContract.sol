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

    struct SubData {
        string someString;
        uint256 someValue;
    }

    struct SimpleStruct {
        uint8 size1;
        uint16 size2;
        uint32 size4;
        uint64 size8;
    }

    struct SomeStruct {
        uint256 field2;
        address field1;
    }

    struct Data {
        address owner;
        address anotherOwner;
        uint128 sharingSlot1;
        uint128 sharingSlot2;
        EnumExample enumExample;
        uint8 afterEnumValue;
        mapping(address => uint128) simpleMapping;
        uint8 afterMappingSlot;
        address[] dynamicArray;
        uint32[3] staticArray;
        uint8 unsignedInt; // solhint-disable-line explicit-types
        uint256 unsignedInt256;
        uint8 unsignedInt8;
        SubData bigStruct;
        int256 signedInt256;
        mapping(ExampleKeyContract => SubData) mappingWithNestedStruct;
        string someStringValue;
        SimpleStruct simpleStruct;
        uint8 afterStructStartsNewSlot;
    }

    uint128 public constant SOME_CONSTANT = 445;
    uint128 public constant SOME_CASTED_CONSTANT = uint128(SOME_CONSTANT); // solhint-disable-line numcast/safe-cast
    address private constant SOME_ADDRESS = 0xe27454c382e79a1876096B691ef4b52747B7097D;

    uint256 public stateVariableNumber = 12345;
    string public stateVariableString = "give me some testing data";

    Data public structData;

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

contract ExampleKeyContract {}
