//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccountRBACMixinModuleMock {
    function interactWithAccount(uint accountId, uint inputValue) external;

    function getRBACValue() external view returns (uint);
}
