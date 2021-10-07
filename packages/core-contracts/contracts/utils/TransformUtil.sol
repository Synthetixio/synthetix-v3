//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract TransformUtil {
    function _revertReasonFromBytes(bytes memory callResponse) internal pure returns (string memory) {
        if (callResponse.length > 0) {
            assembly {
                callResponse := add(callResponse, 68)
            }
        }
        return string(callResponse);
    }
}
