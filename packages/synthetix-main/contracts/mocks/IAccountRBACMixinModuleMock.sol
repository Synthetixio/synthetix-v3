//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccountRBACMixinModuleMock {
    function mock_AccountRBACMixin_deposit(uint accountId, uint newDepositMock) external;

    function mock_AccountRBACMixin_mint(uint accountId, uint newMintMock) external;

    function mock_AccountRBACMixin_getDepositMock() external view returns (uint);

    function mock_AccountRBACMixin_getMintMock() external view returns (uint);
}
