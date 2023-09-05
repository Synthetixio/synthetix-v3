// SPDX-License-Identifier: SCRY
pragma solidity 0.8.6;

contract MockMetaMorph {
    function getFeedPortal(
        uint256 ID
    )
        external
        view
        returns (
            uint256 value,
            uint decimals,
            string memory valStr,
            bytes memory valBytes,
            uint timestamp
        )
    {if (ID==0){
        value=100*10*18; 
        decimals=18; 
        timestamp=block.timestamp();}
        else{value=100*10*2; 
        decimals=2; 
        timestamp=block.timestamp();}
    }
}
