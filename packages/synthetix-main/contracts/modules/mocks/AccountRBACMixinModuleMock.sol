//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/AccountRBACMixin.sol";
import "../../mocks/IAccountRBACMixinModuleMock.sol";
import "../../mocks/AccountRBACMixinModuleMockStorage.sol";

contract AccountRBACMixinModuleMock is IAccountRBACMixinModuleMock, AccountRBACMixinModuleMockStorage, AccountRBACMixin {
    function interactWithAccount(uint accountId, uint inputValue)
        external
        override
        onlyWithPerimission(accountId, _STAKE_PERMISSION)
    {
        _mixinModuleMockStore().rbacValue = inputValue;
    }

    function getRBACValue() external view override returns (uint) {
        return _mixinModuleMockStore().rbacValue;
    }
}
