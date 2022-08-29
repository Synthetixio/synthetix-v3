//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IAccountRBACMixinModuleMock {
    function mock_AccountRBACMixin_stake(uint accountId, uint newStakeMock) external;

    function mock_AccountRBACMixin_mint(uint accountId, uint newMintMock) external;

    function mock_AccountRBACMixin_getStakeMock() external view returns (uint);

    function mock_AccountRBACMixin_getMintMock() external view returns (uint);
}
