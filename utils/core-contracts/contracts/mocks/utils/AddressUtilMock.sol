//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../utils/AddressUtil.sol";

contract AddressUtilMock {
    function isContract(address account) public view returns (bool) {
        return AddressUtil.isContract(account);
    }
}
