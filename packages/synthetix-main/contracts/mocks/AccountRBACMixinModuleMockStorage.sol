//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AccountRBACMixinModuleMockStorage {
    struct AccountRBACMixinModuleMockStore {
        uint256 rbacValue;
    }

    function _mixinModuleMockStore() internal pure returns (AccountRBACMixinModuleMockStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.accountrbacmixinmodule")) - 1)
            store.slot := 0x1ce4ca68760c4591c093e69c4f3107e99b4faf6a64521759223b68428b166546
        }
    }
}
