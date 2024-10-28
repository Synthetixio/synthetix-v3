//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/*
 * Used to determine if the currently running code could be running on a fork
 * Designed to make debugging easier for developers when working with parts of the system that work with offchain data or precompiled contracts which may not be simulatable in fork
 *
 * To use this in your fork, you must first set the special code on the checkAddress below. Examples on how to do this:
 *
 * ethers:
 * // you may need to modify `anvil` below to match the actual fork node you are using. be sure to check its docs!
 * provider.send('anvil_setCode', ['0x1234123412341234123412341234123412341234', ethers.toHex('FORK')]);
 *
 *
 * viem:
 * // set up a "test client" as explained here
 * // then:
 * testClient.setCode({ address: '0x1234123412341234123412341234123412341234', bytecode: viem.stringToHex('FORK') })
 */
library ForkDetector {
    // deliberately patterned address (not zero as this is could conceivably be used by a legitimate chain) to `setCode` on
    address constant checkAddress = 0x1234123412341234123412341234123412341234;

    error OnlyOnDevFork();

    function isDevFork() internal view returns (bool) {
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

        contractCode = new bytes(size);
        assembly {
            // actually retrieve the code, this needs assembly
            extcodecopy(checkAddress, add(contractCode, 0x20), 0, size)
        }

        return
            contractCode[0] == "F" &&
            contractCode[1] == "O" &&
            contractCode[2] == "R" &&
            contractCode[3] == "K";
    }

    function requireFork() internal view {
        if (!isDevFork()) {
            revert OnlyOnDevFork();
        }
    }
}
