//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

/**
 * @title Module for atomic buy and sell orders for traders.
 */
interface IAtomicOrderModule {
    /**
     * @notice Thrown when trader specified amounts to buy/sell without holding the underlying asset.
     */
    error InsufficientFunds();
    /**
     * @notice Thrown when trader has not provided allowance for the market to transfer the underlying asset.
     */
    error InsufficientAllowance(uint expected, uint current);

    /**
     * @notice Gets fired when buy trade is complete
     * @param synthMarketId Id of the market used for the trade.
     * @param synthReturned Synth received on the trade based on amount provided by trader.
     * @param totalFees total fees charged to the trader on the transaction.
     * @param collectedFees Fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
     */
    event SynthBought(
        uint indexed synthMarketId,
        uint synthReturned,
        int totalFees,
        uint collectedFees
    );

    /**
     * @notice Gets fired when buy trade is complete
     * @param synthMarketId Id of the market used for the trade.
     * @param amountReturned Amount of snxUSD returned to user based on synth provided by trader.
     * @param totalFees total fees charged to the trader on the transaction.
     * @param collectedFees Fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
     */
    event SynthSold(
        uint indexed synthMarketId,
        uint amountReturned,
        int totalFees,
        uint collectedFees
    );

    /**
     * @notice Initiates a buy trade returning synth for the specified amountUsd.
     * @dev Transfers the specified amountUsd, collects fees through configured fee collector, returns synth to the trader.
     * @dev Leftover fees not collected get deposited into the market manager to improve market PnL.
     * @dev Uses the buyFeedId configured for the market.
     * @param synthMarketId Id of the market used for the trade.
     * @param amountUsd Amount of snxUSD trader is providing allownace to for the trade.
     * @return synthReturned Synth received on the trade based on amount provided by trader.
     */
    function buy(uint128 synthMarketId, uint amountUsd) external returns (uint);

    /**
     * @notice Initiates a sell trade returning snxUSD for the specified amount of synth, sellAmount.
     * @dev Transfers the specified synth, collects fees through configured fee collector, returns snxUSD to the trader.
     * @dev Leftover fees not collected get deposited into the market manager to improve market PnL.
     * @param synthMarketId Id of the market used for the trade.
     * @param sellAmount Amount of synth trader is trading for snxUSD.
     * @return amountReturned Amount of snxUSD returned to user based on synth provided by trader.
     */
    function sell(uint128 synthMarketId, uint sellAmount) external returns (uint);
}
