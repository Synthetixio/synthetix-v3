//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpAccount} from "../storage/PerpAccount.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "../interfaces/IPerpAccountModule.sol";

contract PerpAccountModule is IPerpAccountModule {
    using MarketConfiguration for MarketConfiguration.Data;
    using PerpAccount for PerpAccount.Data;
    using PerpMarket for PerpMarket.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    function transferUsd(uint128 accountId, uint128 marketId, int256 amountDelta) external {
        // Check if this account exists & correct permissions (How to define market specific permissions?)
        Account.exists(accountId);

        MarketConfiguration.Data storage config = MarketConfiguration.load();
        PerpAccount.Data storage account = PerpAccount.load(accountId);
        PerpMarket.Data storage market = PerpMarket.load(marketId);

        ITokenModule snxUsdToken = config.snxUsdToken;
        address collateral = address(snxUsdToken);

        uint256 absAmountDelta = MathUtil.abs(amountDelta);
        uint256 accountCollateral = account.depositedCollateral[collateral];

        if (amountDelta > 0) {
            // Positive means to deposit into the markets.
            uint256 maxDepositsAllowed = config.maxCollateralDeposits[collateral];
            uint256 currentTotalDeposits = market.totalCollateralDeposited[collateral];
            if (currentTotalDeposits + absAmountDelta > maxDepositsAllowed) {
                revert MaxCollateralExceeded(amountDelta, maxDepositsAllowed);
            }
            account.depositedCollateral[collateral] += absAmountDelta;
            market.totalCollateralDeposited[collateral] += absAmountDelta;
            snxUsdToken.transferFrom(msg.sender, address(this), absAmountDelta);
            // TODO: Transfer snxUSD to the Synthetix core system
        } else if (amountDelta < 0) {
            // Negative means to withdraw from the markets.
            if (accountCollateral < absAmountDelta) {
                revert InsufficientCollateral(accountCollateral.toInt(), amountDelta);
            }
            account.depositedCollateral[collateral] -= absAmountDelta;
            market.totalCollateralDeposited[collateral] -= absAmountDelta;
            // TODO: Withdraw from the Synthetix core system
            snxUsdToken.transferFrom(address(this), msg.sender, absAmountDelta);
        } else {
            // A zero amount is a no-op.
            return;
        }

        // TODO: Emit transfer event
    }

    function transferWsteth(uint128 accountId, uint128 marketId, int256 amountDelta) external {}

    function accountDigest(uint128 accountId) external view returns (AccountDigest memory digest) {}
}
