//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "./BModule.sol";
import "../mixins/ModulesMixin.sol";


contract AModule is ModulesMixin {
    /* MUTATIVE FUNCTIONS */

    function setValueViaBModule_cast(uint newValue) public {
        BModule(address(this)).setValue(newValue);
    }

    function setValueViaBModule_router(uint newValue) public {
        (bool success,) = getRouter().delegatecall(
            abi.encodeWithSelector(BModule.setValue.selector, newValue)
        );

        require(success, "Delegatecall failed");
    }
}
