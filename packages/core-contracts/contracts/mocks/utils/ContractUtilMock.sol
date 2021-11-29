//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../utils/ContractUtil.sol";

contract ContractUtilMock is ContractUtil {
    function isContract(address account) public view returns (bool) {
        return _isContract(account);
    }

    function stringify(uint256 value) public pure returns (string memory) {
        return _toString(value);
    }
}
