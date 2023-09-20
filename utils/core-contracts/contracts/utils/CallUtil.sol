//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

library CallUtil {
    function tryCall(address target, bytes memory data) internal returns (bytes memory) {
        (bool success, bytes memory result) = address(target).call(data);

        if (!success) {
            uint len = result.length;
            assembly {
                revert(add(result, 0x20), len)
            }
        }

        return result;
    }
}
