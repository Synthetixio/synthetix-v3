//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AccountRBACMixinModuleMockStorage {
    struct AccountRBACMixinModuleMockStore {
        uint256 depositMock;
        uint256 mintMock;
    }

    function _mixinModuleMockStore() internal pure returns (AccountRBACMixinModuleMockStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.accountrbacmixinmodule")) - 1)
            store.slot := 0x186e65a22afe779f65be55d2f02e866d66351197187020749997986235b258c1
        }
    }
}
