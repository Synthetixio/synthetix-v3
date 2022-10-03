//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../interfaces/ISpotMarket.sol";
import "../interfaces/external/IMarketFee.sol";

contract SpotMarketModule is ISpotMarket {
    using MathUtil for uint256;

    error InsufficientFunds();
    error InsufficientAllowance();

    modifier onlyMarketOwner() {
        require(msg.sender == marketOwner, "Only market owner");
        _;
    }

    constructor(
        address owner,
        address snxAddress,
        address usdTokenAddress
    ) {
        synthetix = snxAddress;
        usdToken = ITokenModule(usdTokenAddress);
        marketOwner = owner;
    }

    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address priceFeed,
        address feeManager
    ) external override onlyMarketOwner returns (uint) {
        Synth newSynth = new Synth(address(this), name, symbol, decimals);
        uint synthMarketId = IMarketManagerModule(synthetix).registerMarket(address(this));
        MarketSynth memory synth = MarketSynth(newSynth, priceFeed, feeManager, synthMarketId);
        marketSynths[synthMarketId] = synth;

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function getMarket(uint marketId) external view override returns (MarketSynth memory) {
        return marketSynths[marketId];
    }

    // TODO: interact with OracleManager to get price for market synth
    function getSynthPrice(uint marketId) external pure override returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return _getCurrentPrice(marketId);
    }

    /* should this accept marketId as a param */
    function reportedDebt(uint marketId) external view override returns (uint) {
        MarketSynth storage market = marketSynths[marketId];
        return market.synth.totalSupply().mulDecimal(_getCurrentPrice(marketId));
    }

    function updateFeeManager(uint marketId, address newFeeManager) external override onlyMarketOwner {
        marketSynths[marketId].feeManager = newFeeManager;
    }

    function exchange(
        uint fromMarketId,
        uint toMarketId,
        uint amount
    ) external override returns (uint) {
        MarketSynth storage fromMarket = marketSynths[fromMarketId];
        MarketSynth storage toMarket = marketSynths[toMarketId];

        uint amountUsd = _synthUsdExchangeRate(fromMarketId, amount);

        // transfer funds into contract (required for collecting fees)
        IMarketManagerModule(synthetix).withdrawUsd(fromMarketId, address(this), amountUsd);
        // TODO: (verify this is what we want): apply fees using feeManager for synth trading into
        // apply fees to both sides of the trade
        (uint amountUsable, uint feesCollected) = _manageFees(toMarket, amountUsd);

        uint amountToMint = _usdSynthExchangeRate(toMarketId, amountUsable);

        // mint & burn synths
        fromMarket.synth.burn(msg.sender, amount);
        toMarket.synth.mint(msg.sender, amountToMint);

        emit SynthExchanged(fromMarketId, toMarketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function buy(uint marketId, uint amountUsd) external override returns (uint) {
        if (usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (usdToken.allowance(msg.sender, address(this)) < amountUsd) {
            revert InsufficientAllowance();
        }

        MarketSynth storage market = marketSynths[marketId];

        usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (uint amountUsable, uint feesCollected) = _manageFees(market, amountUsd);

        uint amountToMint = _usdSynthExchangeRate(marketId, amountUsable);
        market.synth.mint(msg.sender, amountToMint);

        // check with db on market manager to check for msg sender being the target
        usdToken.approve(address(this), amountUsable); // required for market manager
        IMarketManagerModule(synthetix).depositUsd(marketId, address(this), amountUsable);

        emit SynthBought(marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint marketId, uint sellAmount) external override returns (uint) {
        uint amountToWithdraw = _synthUsdExchangeRate(marketId, sellAmount);

        MarketSynth storage market = marketSynths[marketId];
        market.synth.burn(msg.sender, sellAmount);

        IMarketManagerModule(synthetix).withdrawUsd(marketId, address(this), amountToWithdraw);
        (uint returnAmount, uint feesCollected) = _manageFees(market, amountToWithdraw);

        usdToken.transfer(msg.sender, returnAmount);
        emit SynthSold(marketId, returnAmount, feesCollected);

        return returnAmount;
    }

    // TODO: change from pure once _getCurrentPrice is implemented
    function _synthUsdExchangeRate(uint marketId, uint sellAmount) internal pure returns (uint amountUsd) {
        uint currentPrice = _getCurrentPrice(marketId);
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }

    function _usdSynthExchangeRate(uint marketId, uint amountUsd) internal pure returns (uint synthAmount) {
        uint currentPrice = _getCurrentPrice(marketId);
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function _manageFees(MarketSynth storage market, uint amountUsd) internal returns (uint, uint) {
        usdToken.approve(market.feeManager, amountUsd);
        return IMarketFee(market.feeManager).processFees(msg.sender, market.marketId, amountUsd);
    }

    // TODO: interact with OracleManager to get price for market synth
    function _getCurrentPrice(uint marketId) internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }
}
