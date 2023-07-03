//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Account} from "@synthetixio/main/contracts/storage/Account.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {PerpMarketFactoryConfiguration} from "../storage/PerpMarketFactoryConfiguration.sol";
import {PerpMarket} from "../storage/PerpMarket.sol";
import {PerpAccount} from "../storage/PerpAccount.sol";
import {Error} from "../storage/Error.sol";
import {MathUtil} from "../utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "../interfaces/IPerpAccountModule.sol";

contract PerpAccountModule is IPerpAccountModule {
    using PerpAccount for PerpAccount.Data;
    using PerpMarket for PerpMarket.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /**
     * @inheritdoc IPerpAccountModule
     */
    function transferCollateral(uint128 accountId, uint128 marketId, address collateral, int256 amountDelta) external {
        // Ensure account actually exists (reverts with `AccountNotFound`).
        Account.exists(accountId);
        PerpMarket.Data storage market = PerpMarket.exists(marketId);
        PerpMarketFactoryConfiguration.Data storage config = PerpMarketFactoryConfiguration.load();
        PerpAccount.Data storage account = PerpAccount.load(accountId);

        uint256 absAmountDelta = MathUtil.abs(amountDelta);
        uint256 accountCollateral = account.depositedCollateral[collateral];

        // TODO: Prevent collateral transfers when there's a pending order.

        // TODO: Prevent transfers below a minimum usd?

        // TODO: Check if market actually exists

        // TODO: Check if collateral is supported by bfp-markets (not just Synthetix Core)

        if (amountDelta > 0) {
            // Positive means to deposit into the markets.
            uint256 maxDepositsAllowed = config.maxCollateralDeposits[collateral];
            uint256 currentTotalDeposits = market.totalCollateralDeposited[collateral];

            // Verify whether this will exceed the maximum allowable collateral amount.
            if (currentTotalDeposits + absAmountDelta > maxDepositsAllowed) {
                revert Error.MaxCollateralExceeded(amountDelta, maxDepositsAllowed);
            }

            // Perform deposit.
            IERC20(collateral).transferFrom(msg.sender, address(this), absAmountDelta);
            account.depositedCollateral[collateral] += absAmountDelta;
            market.totalCollateralDeposited[collateral] += absAmountDelta;

            // Emit event.
            emit TransferCollateral(msg.sender, address(this), amountDelta);
        } else if (amountDelta < 0) {
            // Negative means to withdraw from the markets.

            // Verify the collateral previously associated to this account is enough to cover withdraws.
            if (accountCollateral < absAmountDelta) {
                revert Error.InsufficientCollateral(accountCollateral.toInt(), amountDelta);
            }

            // Perform withdrawal.
            IERC20(collateral).transferFrom(address(this), msg.sender, absAmountDelta);
            account.depositedCollateral[collateral] -= absAmountDelta;
            market.totalCollateralDeposited[collateral] -= absAmountDelta;

            // TODO: If an open position exists, verify this does _not_ place them into instant liquidation.

            // Emit event.
            emit TransferCollateral(address(this), msg.sender, amountDelta);
        } else {
            // A zero amount is a no-op.
            return;
        }
    }

    /**
     * @inheritdoc IPerpAccountModule
     */
    function accountDigest(uint128 accountId) external view returns (AccountDigest memory digest) {}
}
