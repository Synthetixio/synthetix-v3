//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/AccountRBACMixin.sol";
import "../../mocks/IAccountRBACMixinModuleMock.sol";
import "../../mocks/AccountRBACMixinModuleMockStorage.sol";

contract AccountRBACMixinModuleMock is IAccountRBACMixinModuleMock, AccountRBACMixinModuleMockStorage, AccountRBACMixin {
    function mock_AccountRBACMixin_stake(uint accountId, uint newStakeMock)
        external
        override
        onlyWithPerimission(accountId, _STAKE_PERMISSION)
    {
        _mixinModuleMockStore().stakeMock = newStakeMock;
    }

    function mock_AccountRBACMixin_mint(uint accountId, uint newMintMock)
        external
        override
        onlyWithPerimission(accountId, _MINT_PERMISSION)
    {
        _mixinModuleMockStore().mintMock = newMintMock;
    }

    function mock_AccountRBACMixin_getStakeMock() external view override returns (uint) {
        return _mixinModuleMockStore().stakeMock;
    }

    function mock_AccountRBACMixin_getMintMock() external view override returns (uint) {
        return _mixinModuleMockStore().mintMock;
    }
}
