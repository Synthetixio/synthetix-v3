//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IAccountModule} from "../interfaces/IAccountModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {Position} from "../storage/Position.sol";
import {PerpsMarket} from "../storage/PerpsMarket.sol";
import {PerpsPrice} from "../storage/PerpsPrice.sol";

contract AccountModule is IAccountModule {
    using PerpsAccount for PerpsAccount.Data;
    using Position for Position.Data;

    function totalCollateralValue(uint128 accountId) external view override returns (uint) {
        return PerpsAccount.load(accountId).getTotalCollateralValue();
    }

    function totalAccountOpenInterest(uint128 accountId) external view override returns (int) {
        return PerpsAccount.load(accountId).getTotalNotionalOpenInterest(accountId);
    }

    function openPosition(
        uint128 accountId,
        uint128 marketId
    ) external view override returns (int, int, int) {
        PerpsMarket.Data storage perpsMarket = PerpsMarket.load(marketId);
        Position.Data storage position = perpsMarket.positions[accountId];

        (, int pnl, int accruedFunding, , ) = position.getPositionData(
            PerpsPrice.getCurrentPrice(marketId)
        );
        return (pnl, accruedFunding, position.size);
    }
}
