//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/*
		Utilities related to reverts and error handling
*/

library RevertUtil {
    error Errors(bytes[] errors);

    function revertIfError(bytes memory reason) internal pure {
        if (reason.length > 0) {
            revertWithReason(reason);
        }
    }
    function revertWithReason(bytes memory reason) internal pure {
        uint256 len = reason.length;
        assembly {
            revert(add(reason, 0x20), len)
        }
    }
}
