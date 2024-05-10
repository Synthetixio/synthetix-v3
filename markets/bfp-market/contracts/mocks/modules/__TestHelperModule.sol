//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {Margin} from "../../storage/Margin.sol";
import {PerpMarket} from "../../storage/PerpMarket.sol";

contract __TestHelperModule {
    using PerpMarket for PerpMarket.Data;
    using Margin for Margin.Data;

    // --- Immutables --- //

    address immutable SYNTHETIX_SUSD;

    constructor(address _synthetix_susd) {
        SYNTHETIX_SUSD = _synthetix_susd;
    }

    function __test_creditAccountMarginProfitUsd(
        uint128 accountId,
        uint128 marketId,
        uint256 creditAmountUsd
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        market.depositedCollateral[SYNTHETIX_SUSD] += creditAmountUsd;
        accountMargin.collaterals[SYNTHETIX_SUSD] += creditAmountUsd;
    }

    function __test_addDebtUsdToAccountMargin(
        uint128 accountId,
        uint128 marketId,
        uint128 debtAmountUsd
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        market.totalTraderDebtUsd += debtAmountUsd;
        accountMargin.debtUsd += debtAmountUsd;
    }
}
