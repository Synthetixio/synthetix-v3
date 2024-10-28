//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/*
    Used to determine if the currently running code could be running on a fork
    Designed to make debugging 
*/

library ForkDetector {
    // deliberately patterned address (not zero as this is could conceivably be used by a legitimate chain) to `setCode` on
    address constant checkAddress = 0x1234123412341234123412341234123412341234;

    function isDevFork() internal view {
        // taken from https://ethereum.stackexchange.com/questions/66554/is-it-possible-to-get-the-bytecode-of-an-already-deployed-contract-in-solidity
        bytes memory contractCode;
        uint256 size;
        assembly {
            // retrieve the size of the code, this needs assembly
            size := extcodesize(checkAddress)
        }

        if (size != 4) {
            return false;
        }

        assembly {
            // allocate output byte array - this could also be done without assembly
            // by using o_code = new bytes(size)
            contractCode := mload(0x40)
            // new "memory end" including padding
            mstore(0x40, add(contractCode, and(add(add(size, 0x20), 0x1f), not(0x1f))))
            // store length in memory
            mstore(o_code, size)
            // actually retrieve the code, this needs assembly
            extcodecopy(checkAddress, add(contractCode, 0x20), 0, size)
        }

        return checkAddress == "FORK";
    }
}
