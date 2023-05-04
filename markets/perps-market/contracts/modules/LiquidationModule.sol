//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import "../interfaces/ILiquidationModule.sol";
import "../storage/PerpsAccount.sol";

contract LiquidationModule is ILiquidationModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using SetUtil for SetUtil.UintSet;
    using PerpsAccount for PerpsAccount.Data;

    function liquidate(uint128 accountId) external override {
        // 1. load account
        _liquidateAccount(accountId);
    }

    function liquidateFlagged() external override {
        PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();
        SetUtil.UintSet storage liquidatableAccounts = factory.liquidatableAccounts;

        for (uint i = 0; i < factory.liquidatableAccounts.length(); i++) {
            _liquidateAccount(liquidatableAccounts.valueAt(i).to128());
        }
    }

    function _liquidateAccount(uint128 accountId) private {
        PerpsAccount.Data storage account = PerpsAccount.load(accountId);
        uint accountCollateralValue = PerpsAccount.markForLiquidation(accountId);

        if (account.flaggedForLiquidation) {
            // 2. liquidate account
            account.liquidateAccount(accountId, accountCollateralValue);

            PerpsMarketFactory.Data storage factory = PerpsMarketFactory.load();

            if (account.openPositionMarketIds.length() == 0) {
                account.flaggedForLiquidation = false;
                factory.liquidatableAccounts.remove(accountId);
            }
        }
    }
}
