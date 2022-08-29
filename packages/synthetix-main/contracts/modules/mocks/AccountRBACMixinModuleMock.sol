//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/AccountRBACMixin.sol";
import "../../mocks/IAccountRBACMixinModuleMock.sol";
import "../../mocks/AccountRBACMixinModuleMockStorage.sol";

contract AccountRBACMixinModuleMock is IAccountRBACMixinModuleMock, AccountRBACMixinModuleMockStorage, AccountRBACMixin {
    function mock_AccountRBACMixin_deposit(uint accountId, uint newDepositMock)
        external
        override
        onlyWithPermission(accountId, _DEPOSIT_PERMISSION)
    {
        _mixinModuleMockStore().depositMock = newDepositMock;
    }

    function mock_AccountRBACMixin_mint(uint accountId, uint newMintMock)
        external
        override
        onlyWithPermission(accountId, _MINT_PERMISSION)
    {
        _mixinModuleMockStore().mintMock = newMintMock;
    }

    function mock_AccountRBACMixin_getDepositMock() external view override returns (uint) {
        return _mixinModuleMockStore().depositMock;
    }

    function mock_AccountRBACMixin_getMintMock() external view override returns (uint) {
        return _mixinModuleMockStore().mintMock;
    }
}
