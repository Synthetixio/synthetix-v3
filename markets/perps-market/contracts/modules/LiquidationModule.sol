//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {SafeCastU256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {ILiquidationModule} from "../interfaces/ILiquidationModule.sol";
import {PerpsAccount} from "../storage/PerpsAccount.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";

contract LiquidationModule is ILiquidationModule {
    using SafeCastU256 for uint256;
    using SetUtil for SetUtil.UintSet;
    using PerpsAccount for PerpsAccount.Data;

    function liquidate(uint128 accountId) external override {
        // 1. load account
        _liquidateAccount(accountId);
    }

    function liquidateFlagged() external override {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        for (uint i = 0; i < liquidatableAccounts.length(); i++) {
            _liquidateAccount(liquidatableAccounts.valueAt(i).to128());
        }
    }

    function _liquidateAccount(uint128 accountId) internal {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        account.markForLiquidation(accountId);

        if (account.flaggedForLiquidation) {
            account.liquidateAccount(accountId);
            account.removeFromLiquidation(accountId);
        }
    }
}
