//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/StringUtil.sol";

contract StringUtilMock {
    function uintToString(uint256 value) public pure returns (string memory) {
        return StringUtil.uintToString(value);
    }
}
