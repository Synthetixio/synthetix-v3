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
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        if (!liquidatableAccounts.contains(accountId)) {
            (bool isEligible, , ) = account.isEligibleForLiquidation();

            if (isEligible) {
                account.flagForLiquidation();
                _liquidateAccount(account);
            } else {
                revert NotEligibleForLiquidation(accountId);
            }
        } else {
            _liquidateAccount(account);
        }
    }

    function liquidateFlagged() external override {
        SetUtil.UintSet storage liquidatableAccounts = GlobalPerpsMarket
            .load()
            .liquidatableAccounts;

        for (uint i = 0; i < liquidatableAccounts.length(); i++) {
            uint128 accountId = liquidatableAccounts.valueAt(i).to128();
            _liquidateAccount(PerpsAccount.load(accountId));
        }
    }

    function _liquidateAccount(PerpsAccount.Data storage account) internal {
        account.liquidateAccount();

        // TODO: account can be removed from liquidation if the margin reqs are met,

        if (account.openPositionMarketIds.length() == 0) {
            GlobalPerpsMarket.load().liquidatableAccounts.remove(account.id);
        }

        // TODO: emit event
    }
}
