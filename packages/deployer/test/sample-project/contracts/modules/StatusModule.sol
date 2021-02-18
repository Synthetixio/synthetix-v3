//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "../storage/StatusStorage.sol";
import "../mixins/OwnerMixin.sol";


contract StatusModule is StatusStorageNamespace, OwnerMixin {
    /* MUTATIVE FUNCTIONS */

    function suspendSystem() public onlyOwner {
        _statusStorage().systemSuspended = true;
    }

    function resumeSystem() public onlyOwner {
        _statusStorage().systemSuspended = false;
    }

    /* VIEW FUNCTIONS */

    function isSystemSuspended() public view returns (bool) {
        return _statusStorage().systemSuspended;
    }
}
