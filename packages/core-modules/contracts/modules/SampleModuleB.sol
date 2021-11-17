//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../mixins/CommsMixin.sol";
import "./SampleModuleA.sol";

contract SampleModuleB is CommsMixin {
    function setSomeValueOnSampleModuleA(uint newValue) public {
        _intermoduleCall(abi.encodeWithSelector(SampleModuleA.setSomeValue.selector, newValue));
    }
}
