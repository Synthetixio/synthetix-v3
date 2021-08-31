//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../storage/GlobalNamespace.sol";
import "../mixins/ModulesMixin.sol";
import "./SomeModule.sol";

contract AnotherModule is ModulesMixin {
    /* MUTATIVE FUNCTIONS */

    // Communicate with SomeModule using Cast mode
    function setSomeValueCast(uint newValue) public {
        SomeModule(address(this)).setSomeValue(newValue);
    }

    // Communicate with SomeModule using Router mode
    function setSomeValueRouter(uint newValue) public {
        (bool success, ) = _getRouter().delegatecall(abi.encodeWithSelector(SomeModule.setSomeValue.selector, newValue));

        require(success, "Delegatecall failed");
    }
}
