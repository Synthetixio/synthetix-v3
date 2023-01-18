//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/*
    Reference implementations:
    * OpenZeppelin - https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Strings.sol
*/

library StringUtil {
    function uintToString(uint value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            // solhint-disable-next-line numcast/safe-cast
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
