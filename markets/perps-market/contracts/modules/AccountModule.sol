//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAccountModule.sol";
import "../storage/PerpsAccount.sol";

contract AccountModule is IAccountModule {
    using PerpsAccount for PerpsAccount.Data;

    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(accountId);
        return perpsAccount.getTotalCollateralValue();
    }

    function totalAccountOpenInterest(uint128 accountId) external view override returns (int) {
        PerpsAccount.Data storage perpsAccount = PerpsAccount.load(accountId);
        return perpsAccount.getTotalAccountOpenInterest(accountId);
    }
}
