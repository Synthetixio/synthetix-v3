//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/CoreCommsMixin.sol";
import "./SomeModuleMock.sol";

contract AnotherModuleMock is CoreCommsMixin {
    function setSomeValueOnSomeModule(uint newValue) public {
        _intermoduleCall(abi.encodeWithSelector(SomeModuleMock.setSomeValue.selector, newValue));
    }
}
