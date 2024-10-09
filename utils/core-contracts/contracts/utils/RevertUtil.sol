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

    function revertManyIfError(bytes[] memory reasons) internal pure {
        uint256 actualErrors = 0;

        for (uint256 i = 0; i < reasons.length; i++) {
            if (reasons[i].length > 0) {
                actualErrors++;
            }
        }

        if (actualErrors > 0) {
            bytes[] memory compressed = new bytes[](actualErrors);
            uint256 cur = 0;
            for (uint256 i = 0; i < reasons.length; i++) {
                if (reasons[i].length > 0) {
                    compressed[cur++] = reasons[i];
                }
            }
            revert Errors(compressed);
        }
    }

    function revertWithReason(bytes memory reason) internal pure {
        uint256 len = reason.length;
        assembly {
            revert(add(reason, 0x20), len)
        }
    }
}
