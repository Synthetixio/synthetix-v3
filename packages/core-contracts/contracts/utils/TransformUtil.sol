//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract TransformUtil {
    function _revertReasonFromBytes(bytes memory callResponse) internal pure returns (string memory) {
        // Here we are offseting the callResponse by 68 bytes to go to the revert message section
        // i.e. a typical callResponse with a revert message will be like the following
        // where the message starts at 0x44 (68 in decimal)
        // (0x00) 08c379a0000000000000000000000000
        // (0x10) 00000000000000000000000000000000
        // (0x20) 00000020000000000000000000000000
        // (0x30) 00000000000000000000000000000000
        // (0x40) 0000001f 696e636f72726563746c79207365747320696d706c656d656e746174696f6e00
        //                 ^ (0x44)
        if (callResponse.length > 0) {
            assembly {
                callResponse := add(callResponse, 68)
            }
        }
        return string(callResponse);
    }
}
