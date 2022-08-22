//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../interfaces/IPrimaryModule.sol";

contract PrimaryModule is IPrimaryModule {
    function getNumber() public pure virtual override returns (uint) {
        return 100;
    }
}
