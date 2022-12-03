//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IValidInterfacedModule {
    function getValue() external pure returns (uint);
}

contract ValidInterfacedModule is IValidInterfacedModule {
    function getValue() external pure override returns (uint) {
        return 1;
    }
}

contract InvalidInterfacedModule is IValidInterfacedModule {
    function getValue() external pure override returns (uint) {
        return 1;
    }

    function anotherGetValue() external pure returns (uint) {
        return 2;
    }
}
