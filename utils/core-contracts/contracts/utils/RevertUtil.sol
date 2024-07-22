//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/*
		Utilities related to reverts and error handling
*/

library RevertUtil {
    function revertWithReason(bytes memory reason) internal {
        uint256 len = reason.length;
        assembly {
            revert(add(reason, 0x20), len)
        }
    }
}
