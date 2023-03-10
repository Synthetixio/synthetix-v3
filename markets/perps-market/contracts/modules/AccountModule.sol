//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAccountModule.sol";
import "../storage/PerpsAccount.sol";

contract AccountModule is IAccountModule {
    using PerpsAccount for PerpsAccount.Data;

    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalCollateralValue();
    }

    function totalAccountOpenInterest(uint128 accountId) external view override returns (int) {
        return PerpsAccount.load(accountId).getTotalAccountOpenInterest(accountId);
    }
}
