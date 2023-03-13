//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IAccountModule.sol";
import "../storage/PerpsAccount.sol";
import "../storage/Position.sol";

contract AccountModule is IAccountModule {
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;

    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalCollateralValue();
    }

    function totalAccountOpenInterest(uint128 accountId) external view override returns (int) {
        return PerpsAccount.load(accountId).getTotalAccountOpenInterest(accountId);
    }

    function openPosition(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (int, int, int) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        Position.Data memory position = perpsMarket.positions[accountId];

        (, int pnl, int accruedFunding, , ) = position.calculateExpectedPosition(
            PerpsPrice.getCurrentPrice(marketId)
        );
        return (pnl, accruedFunding, position.size);
    }
}
