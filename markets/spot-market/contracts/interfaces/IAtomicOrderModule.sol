//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "../storage/OrderFees.sol";

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
    error ExceedsMaxUsdAmount(uint maxUsdAmount, uint usdAmountCharged);
    error ExceedsMaxSynthAmount(uint maxSynthAmount, uint synthAmountCharged);
    /**
     * @notice Thrown when a trade doesn't meet minimum expected return amount.
     */
    error InsufficientAmountReceived(uint expected, uint current);

    /**
     * @notice Gets fired when buy trade is complete
     * @param synthMarketId Id of the market used for the trade.
     * @param synthReturned Synth received on the trade based on amount provided by trader.
     * @param fees breakdown of all fees incurred for transaction.
     * @param collectedFees Fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
     * @param referrer Optional address of the referrer, for fee share
     */
    event SynthBought(
        uint indexed synthMarketId,
        uint synthReturned,
        OrderFees.Data fees,
        uint collectedFees,
        address referrer
    );

    /**
     * @notice Gets fired when buy trade is complete
     * @param synthMarketId Id of the market used for the trade.
     * @param amountReturned Amount of snxUSD returned to user based on synth provided by trader.
     * @param fees breakdown of all fees incurred for transaction.
     * @param collectedFees Fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
     * @param referrer Optional address of the referrer, for fee share
     */
    event SynthSold(
        uint indexed synthMarketId,
        uint amountReturned,
        OrderFees.Data fees,
        uint collectedFees,
        address referrer
    );

    /**
     * @notice Initiates a buy trade returning synth for the specified amountUsd.
     * @dev Transfers the specified amountUsd, collects fees through configured fee collector, returns synth to the trader.
     * @dev Leftover fees not collected get deposited into the market manager to improve market PnL.
     * @dev Uses the buyFeedId configured for the market.
     * @param synthMarketId Id of the market used for the trade.
     * @param amountUsd Amount of snxUSD trader is providing allownace to for the trade.
     * @param minAmountReceived Min Amount of synth is expected the trader to receive otherwise the transaction will revert.
     * @param referrer Optional address of the referrer, for fee share
     * @return synthReturned Synth received on the trade based on amount provided by trader.
     * @return fees breakdown of all the fees incurred for the transaction.
     */
    function buyExactIn(
        uint128 synthMarketId,
        uint amountUsd,
        uint minAmountReceived,
        address referrer
    ) external returns (uint, OrderFees.Data memory);

    function buy(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived
    ) external returns (uint synthAmount, OrderFees.Data memory fees);

    function buy(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) external returns (uint synthAmount, OrderFees.Data memory fees);

    function buyExactOut(
        uint128 synthMarketId,
        uint synthAmount,
        uint maxUsdAmount,
        address referrer
    ) external returns (uint, OrderFees.Data memory);

    function quoteBuyExactIn(
        uint128 synthMarketId,
        uint usdAmount
    ) external view returns (uint256 synthAmount, OrderFees.Data memory);

    function quoteBuyExactOut(
        uint128 synthMarketId,
        uint synthAmount
    ) external view returns (uint256 usdAmountCharged, OrderFees.Data memory);

    /**
     * @notice Initiates a sell trade returning snxUSD for the specified amount of synth, sellAmount.
     * @dev Transfers the specified synth, collects fees through configured fee collector, returns snxUSD to the trader.
     * @dev Leftover fees not collected get deposited into the market manager to improve market PnL.
     * @param synthMarketId Id of the market used for the trade.
     * @param sellAmount Amount of synth trader is trading for snxUSD.
     * @param minAmountReceived Min Amount of snxUSD is expected the trader to receive otherwise the transaction will revert.
     * @param referrer Optional address of the referrer, for fee share
     * @return amountReturned Amount of snxUSD returned to user based on synth provided by trader.
     * @return fees breakdown of all the fees incurred for the transaction.
     */
    function sellExactIn(
        uint128 synthMarketId,
        uint sellAmount,
        uint minAmountReceived,
        address referrer
    ) external returns (uint, OrderFees.Data memory);

    function sellExactOut(
        uint128 marketId,
        uint usdAmount,
        uint maxAmountReceived,
        address referrer
    ) external returns (uint, OrderFees.Data memory);

    function sell(
        uint128 marketId,
        uint synthAmount,
        uint minUsdAmount,
        address referrer
    ) external returns (uint usdAmountReceived, OrderFees.Data memory fees);

    function sell(
        uint128 marketId,
        uint synthAmount,
        uint minUsdAmount
    ) external returns (uint usdAmountReceived, OrderFees.Data memory fees);

    function quoteSellExactIn(
        uint128 marketId,
        uint synthAmount
    ) external view returns (uint256 returnAmount, OrderFees.Data memory);

    function quoteSellExactOut(
        uint128 marketId,
        uint usdAmount
    ) external view returns (uint256 synthToBurn, OrderFees.Data memory);
}
