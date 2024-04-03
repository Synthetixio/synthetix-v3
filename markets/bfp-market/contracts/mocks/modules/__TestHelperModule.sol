//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import {SYNTHETIX_USD_MARKET_ID} from "../../storage/PerpMarketConfiguration.sol";
import {Margin} from "../../storage/Margin.sol";
import {PerpMarket} from "../../storage/PerpMarket.sol";

contract __TestHelperModule {
    using PerpMarket for PerpMarket.Data;
    using Margin for Margin.Data;

    function __test_creditAccountMarginProfitUsd(
        uint128 accountId,
        uint128 marketId,
        uint256 creditAmountUsd
    ) external {
        OwnableStorage.onlyOwner();

        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        Margin.Data storage accountMargin = Margin.load(accountId, marketId);

        market.depositedCollateral[SYNTHETIX_USD_MARKET_ID] += creditAmountUsd;
        accountMargin.collaterals[SYNTHETIX_USD_MARKET_ID] += creditAmountUsd;
    }
}
