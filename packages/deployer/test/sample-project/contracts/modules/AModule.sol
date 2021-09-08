//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../mixins/GenIMCMixin.sol";
import "./SomeModule.sol";

contract AModule is GenIMCMixin {
    /* MUTATIVE FUNCTIONS */

    // Communicate with SomeModule using Cast mode and IMC Mixin
    function setSomeValueIMC(uint newValue) public {
        SomeModule(SomeModuleAddress).setSomeValue(newValue);
    }
}
