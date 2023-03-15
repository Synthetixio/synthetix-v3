//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/FeeConfiguration.sol";
import "../interfaces/IAtomicOrderModule.sol";
import "../utils/SynthUtil.sol";

import "hardhat/console.sol";

/**
 * @title Module for buying and selling atomically registered synths.
 * @dev See IAtomicOrderModule.
 */
contract AtomicOrderModule is IAtomicOrderModule {
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using FeeConfiguration for FeeConfiguration.Data;
    using OrderFees for OrderFees.Data;
    using Price for Price.Data;

    function buyExactOut(
        uint128 marketId,
        uint synthAmount,
        uint maxUsdAmount,
        address referrer
    ) external override returns (uint usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration;
        (usdAmountCharged, fees, feeConfiguration) = _quoteBuy(
            marketId,
            synthAmount,
            Transaction.Type.BUY_EXACT_OUT
        );

        if (usdAmountCharged > maxUsdAmount) {
            revert ExceedsMaxUsdAmount(maxUsdAmount, usdAmountCharged);
        }

        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmountCharged);

        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY_EXACT_OUT
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmountCharged - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer);

        return (synthAmount, fees);
    }

    function buy(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) external override returns (uint synthAmount, OrderFees.Data memory fees) {
        return buyExactIn(marketId, usdAmount, minAmountReceived, referrer);
    }

    function buy(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived
    ) external override returns (uint synthAmount, OrderFees.Data memory fees) {
        return buyExactIn(marketId, usdAmount, minAmountReceived, address(0));
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buyExactIn(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) public override returns (uint synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        // transfer usd funds
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        FeeConfiguration.Data storage feeConfiguration;
        (synthAmount, fees, feeConfiguration) = _quoteBuy(
            marketId,
            usdAmount,
            Transaction.Type.BUY_EXACT_IN
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.BUY_EXACT_IN
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmount - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, fees, collectedFees, referrer);

        return (synthAmount, fees);
    }

    function quoteBuyExactIn(
        uint128 marketId,
        uint usdAmount
    ) external view override returns (uint256 synthAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (synthAmount, fees, ) = _quoteBuy(marketId, usdAmount, Transaction.Type.BUY_EXACT_IN);
    }

    function quoteBuyExactOut(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 usdAmountCharged, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (usdAmountCharged, fees, ) = _quoteBuy(
            marketId,
            synthAmount,
            Transaction.Type.BUY_EXACT_OUT
        );
    }

    function quoteSellExactIn(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (returnAmount, fees, ) = _quoteSell(marketId, synthAmount, Transaction.Type.SELL_EXACT_IN);
    }

    function quoteSellExactOut(
        uint128 marketId,
        uint usdAmount
    ) external view override returns (uint256 synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (synthToBurn, fees, ) = _quoteSell(marketId, usdAmount, Transaction.Type.SELL_EXACT_OUT);
    }

    function sell(
        uint128 marketId,
        uint synthAmount,
        uint minUsdAmount,
        address referrer
    ) external override returns (uint usdAmountReceived, OrderFees.Data memory fees) {
        return sellExactIn(marketId, synthAmount, minUsdAmount, referrer);
    }

    function sell(
        uint128 marketId,
        uint synthAmount,
        uint minUsdAmount
    ) external override returns (uint usdAmountReceived, OrderFees.Data memory fees) {
        return sellExactIn(marketId, synthAmount, minUsdAmount, address(0));
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sellExactIn(
        uint128 marketId,
        uint256 synthAmount,
        uint minAmountReceived,
        address referrer
    ) public override returns (uint256 returnAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration;
        (returnAmount, fees, feeConfiguration) = _quoteSell(
            marketId,
            synthAmount,
            Transaction.Type.SELL_EXACT_IN
        );

        if (returnAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, returnAmount);
        }

        // Burn synths provided
        // Burn after calculation because skew is calculating using total supply prior to fill
        SynthUtil.getToken(marketId).burn(msg.sender, synthAmount);

        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL_EXACT_IN
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, returnAmount);

        emit SynthSold(marketId, returnAmount, fees, collectedFees, referrer);
    }

    function sellExactOut(
        uint128 marketId,
        uint usdAmount,
        uint maxAmountBurned,
        address referrer
    ) external override returns (uint synthToBurn, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration;
        (synthToBurn, fees, feeConfiguration) = _quoteSell(
            marketId,
            usdAmount,
            Transaction.Type.SELL_EXACT_OUT
        );

        if (synthToBurn > maxAmountBurned) {
            revert ExceedsMaxSynthAmount(maxAmountBurned, synthToBurn);
        }

        SynthUtil.getToken(marketId).burn(msg.sender, synthToBurn);
        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            fees,
            msg.sender,
            referrer,
            spotMarketFactory,
            Transaction.Type.SELL_EXACT_IN
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, usdAmount);

        emit SynthSold(marketId, usdAmount, fees, collectedFees, referrer);
    }

    function _quoteSell(
        uint128 marketId,
        uint amount, // based on transaction type, either synthAmount or usdAmount
        Transaction.Type transactionType
    )
        private
        view
        returns (
            uint256 returnAmount,
            OrderFees.Data memory fees,
            FeeConfiguration.Data storage feeConfiguration
        )
    {
        uint usdAmount = amount;
        if (transactionType == Transaction.Type.SELL_EXACT_IN) {
            usdAmount = Price.synthUsdExchangeRate(marketId, amount, transactionType);
        }

        feeConfiguration = FeeConfiguration.load(marketId);
        (returnAmount, fees) = feeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, transactionType),
            transactionType
        );

        // in the case of SELL_EXACT_OUT, we return the synth that will be burned
        // from the user for the given usd amount.  Otherwise, we return the USD
        // amount the user receives based on the synth amount they are selling
        if (transactionType == Transaction.Type.SELL_EXACT_OUT) {
            returnAmount = Price.usdSynthExchangeRate(marketId, returnAmount, transactionType);
        }
    }

    function _quoteBuy(
        uint128 marketId,
        uint amount, // based on transaction type, either synthAmount or usdAmount
        Transaction.Type transactionType
    )
        private
        view
        returns (
            uint returnAmount,
            OrderFees.Data memory fees,
            FeeConfiguration.Data storage feeConfiguration
        )
    {
        uint usdAmount = amount;
        if (transactionType == Transaction.Type.BUY_EXACT_OUT) {
            usdAmount = Price.synthUsdExchangeRate(marketId, amount, transactionType);
        }

        feeConfiguration = FeeConfiguration.load(marketId);
        (returnAmount, fees) = feeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, transactionType),
            transactionType
        );
        // in the case of BUY_EXACT_IN, we return the synth to mint to the user
        // in the case of BUY_EXACT_OUT, we return the USD amount to charge user
        if (transactionType == Transaction.Type.BUY_EXACT_IN) {
            returnAmount = Price.usdSynthExchangeRate(marketId, returnAmount, transactionType);
        }

        return (returnAmount, fees, feeConfiguration);
    }
}
