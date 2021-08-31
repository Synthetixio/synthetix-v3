//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./BModule.sol";
import "../mixins/ModulesMixin.sol";

contract AModule is ModulesMixin {
    /* MUTATIVE FUNCTIONS */

    // solhint-disable-next-line func-name-mixedcase
    function setValueViaBModule_cast(uint newValue) public {
        BModule(address(this)).setValue(newValue);
    }

    // solhint-disable-next-line func-name-mixedcase
    function setValueViaBModule_router(uint newValue) public {
        (bool success, ) = getRouter().delegatecall(abi.encodeWithSelector(BModule.setValue.selector, newValue));

        require(success, "Delegatecall failed");
    }
}
