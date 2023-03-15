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
    using Price for Price.Data;

    function buyExactOut(
        uint128 marketId,
        uint synthAmount,
        uint maxUsdAmount,
        address referrer
    ) external override returns (uint usdAmountCharged, int totalFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration;
        (usdAmountCharged, totalFees, feeConfiguration) = _quoteBuy(
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
            totalFees,
            msg.sender,
            spotMarketFactory,
            Transaction.Type.BUY_EXACT_OUT
        );

        // TODO: send to referrer first
        spotMarketFactory.depositToMarketManager(marketId, usdAmountCharged - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees, referrer);

        return (synthAmount, totalFees);
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function buyExactIn(
        uint128 marketId,
        uint usdAmount,
        uint minAmountReceived,
        address referrer
    ) external override returns (uint synthAmount, int totalFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        // transfer usd funds
        spotMarketFactory.usdToken.transferFrom(msg.sender, address(this), usdAmount);

        FeeConfiguration.Data storage feeConfiguration;
        (synthAmount, totalFees, feeConfiguration) = _quoteBuy(
            marketId,
            usdAmount,
            Transaction.Type.BUY_EXACT_IN
        );

        if (synthAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, synthAmount);
        }

        uint collectedFees = feeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            spotMarketFactory,
            Transaction.Type.BUY_EXACT_IN
        );

        spotMarketFactory.depositToMarketManager(marketId, usdAmount - collectedFees);
        SynthUtil.getToken(marketId).mint(msg.sender, synthAmount);

        emit SynthBought(marketId, synthAmount, totalFees, collectedFees, referrer);

        return (synthAmount, totalFees);
    }

    function quoteBuyExactIn(
        uint128 marketId,
        uint usdAmount
    ) external view override returns (uint256 synthAmount, int256 totalFees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (synthAmount, totalFees, ) = _quoteBuy(marketId, usdAmount, Transaction.Type.BUY_EXACT_IN);
    }

    function quoteBuyExactOut(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 usdAmountCharged, int256 totalFees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (usdAmountCharged, totalFees, ) = _quoteBuy(
            marketId,
            synthAmount,
            Transaction.Type.BUY_EXACT_OUT
        );
    }

    function quoteSellExactIn(
        uint128 marketId,
        uint synthAmount
    ) external view override returns (uint256 returnAmount, int256 totalFees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (returnAmount, totalFees, ) = _quoteSell(
            marketId,
            synthAmount,
            Transaction.Type.SELL_EXACT_IN
        );
    }

    function quoteSellExactOut(
        uint128 marketId,
        uint usdAmount
    ) external view override returns (uint256 synthToBurn, int totalFees) {
        SpotMarketFactory.load().isValidMarket(marketId);

        (synthToBurn, totalFees, ) = _quoteSell(
            marketId,
            usdAmount,
            Transaction.Type.SELL_EXACT_OUT
        );
    }

    /**
     * @inheritdoc IAtomicOrderModule
     */
    function sellExactIn(
        uint128 marketId,
        uint256 synthAmount,
        uint minAmountReceived,
        address referrer
    ) external override returns (uint256 returnAmount, int totalFees, uint collectedFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration;
        (returnAmount, totalFees, feeConfiguration) = _quoteSell(
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

        collectedFees = feeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            spotMarketFactory,
            Transaction.Type.SELL_EXACT_IN
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, returnAmount);

        emit SynthSold(marketId, returnAmount, totalFees, collectedFees, referrer);
    }

    function sellExactOut(
        uint128 marketId,
        uint usdAmount,
        uint maxAmountBurned,
        address referrer
    ) external override returns (uint synthToBurn, int totalFees, uint collectedFees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        spotMarketFactory.isValidMarket(marketId);

        FeeConfiguration.Data storage feeConfiguration;
        (synthToBurn, totalFees, feeConfiguration) = _quoteSell(
            marketId,
            usdAmount,
            Transaction.Type.SELL_EXACT_OUT
        );

        if (synthToBurn > maxAmountBurned) {
            revert ExceedsMaxSynthAmount(maxAmountBurned, synthToBurn);
        }

        SynthUtil.getToken(marketId).burn(msg.sender, synthToBurn);
        collectedFees = feeConfiguration.collectFees(
            marketId,
            totalFees,
            msg.sender,
            spotMarketFactory,
            Transaction.Type.SELL_EXACT_IN
        );

        spotMarketFactory.synthetix.withdrawMarketUsd(marketId, msg.sender, usdAmount);

        emit SynthSold(marketId, usdAmount, totalFees, collectedFees, referrer);
    }

    function _quoteSell(
        uint128 marketId,
        uint amount, // based on transaction type, either synthAmount or usdAmount
        Transaction.Type transactionType
    ) private view returns (uint256, int256, FeeConfiguration.Data storage) {
        uint usdAmount = amount;
        if (transactionType == Transaction.Type.SELL_EXACT_IN) {
            usdAmount = Price.synthUsdExchangeRate(marketId, amount, transactionType);
        }

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(marketId);
        (uint amountAfterFees, int totalFees, ) = feeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, transactionType),
            transactionType
        );

        uint returnAmount = amountAfterFees;
        // in the case of SELL_EXACT_OUT, we return the synth that will be burned
        // from the user for the given usd amount.  Otherwise, we return the USD
        // amount the user receives based on the synth amount they are selling
        if (transactionType == Transaction.Type.SELL_EXACT_OUT) {
            returnAmount = Price.usdSynthExchangeRate(marketId, amountAfterFees, transactionType);
        }

        return (returnAmount, totalFees, feeConfiguration);
    }

    function _quoteBuy(
        uint128 marketId,
        uint amount, // based on transaction type, either synthAmount or usdAmount
        Transaction.Type transactionType
    ) private view returns (uint, int, FeeConfiguration.Data storage) {
        uint usdAmount = amount;
        if (transactionType == Transaction.Type.BUY_EXACT_OUT) {
            usdAmount = Price.synthUsdExchangeRate(marketId, amount, transactionType);
        }

        FeeConfiguration.Data storage feeConfiguration = FeeConfiguration.load(marketId);
        (uint amountAfterFees, int totalFees, ) = feeConfiguration.calculateFees(
            marketId,
            msg.sender,
            usdAmount,
            Price.getCurrentPrice(marketId, transactionType),
            transactionType
        );

        uint returnAmount = amountAfterFees;
        // in the case of BUY_EXACT_IN, we return the synth to mint to the user
        // in the case of BUY_EXACT_OUT, we return the USD amount to charge user
        if (transactionType == Transaction.Type.BUY_EXACT_IN) {
            returnAmount = Price.usdSynthExchangeRate(marketId, amountAfterFees, transactionType);
        }

        return (returnAmount, totalFees, feeConfiguration);
    }
}
