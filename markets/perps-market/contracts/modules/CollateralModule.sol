//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/ICollateralModule.sol";

contract CollateralModule is ICollateralModule {
    function modifyCollateral(uint128 accountId, address collateralType, uint amount) external {
        // RBAC check for permission of msg.sender for account id

        // currentAmount = check collateral associated with the account

        // if collateralType == snxUSD token
            // if greater
            // else
        // else
            // if greater
            // else

        // record change
        
        // emit event
    }
}