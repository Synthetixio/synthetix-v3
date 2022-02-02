//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/CommsMixin.sol";
import "../../interfaces/ISampleModuleB.sol";
import "./SampleModuleA.sol";

contract SampleModuleB is CommsMixin, ISampleModuleB {
    function setSomeValueOnSampleModuleA(uint newValue) public override {
        _intermoduleCall(abi.encodeWithSelector(SampleModuleA.setSomeValue.selector, newValue));
    }
}
