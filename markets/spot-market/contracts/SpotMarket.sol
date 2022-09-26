//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/main/contracts/interfaces/IUSDTokenModule.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/market-fee-manager/interfaces/IMarketFeeManager.sol";
import "../interfaces/ISpotMarket.sol";
import "./Synth.sol";

contract SpotMarket is ISpotMarket, Ownable {
    using MathUtil for uint256;

    struct MarketSynth {
        Synth synth;
        address priceFeed; // will become oracle manager id
        address feeManager;
    }

    IERC20 public usdToken;
    address public synthetix;

    mapping(uint => MarketSynth) public marketSynths;

    constructor(address snxAddress, address marketOwner) {
        synthetix = snxAddress;
        usdToken = IERC20(IUSDTokenModule(synthetix).getUSDTokenAddress());

        nominateNewOwner(marketOwner);
        acceptOwnership();
    }

    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address priceFeed,
        address feeManager
    ) external override onlyOwner returns (uint) {
        Synth newSynth = new Synth(address(this), name, symbol, decimals);
        uint synthMarketId = IMarketManagerModule(synthetix).registerMarket(address(this));
        MarketSynth memory synth = MarketSynth(newSynth, priceFeed, feeManager);
        marketSynths[synthMarketId] = synth;

        emit SynthRegistered(synthMarketId);

        return synthMarketId;
    }

    function getMarket(uint marketId) external view override returns (address synthAddress) {
        synthAddress = address(marketSynths[marketId].synth);
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

    function buy(uint marketId, uint amountUsd) external override returns (uint) {
        if (usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (usdToken.allowance(msg.sender, address(this)) < amountUsd) {
            revert InsufficientAllowance();
        }

        MarketSynth storage market = marketSynths[marketId];

        usdToken.transferFrom(msg.sender, address(this), amountUsd);
        usdToken.approve(market.feeManager, amountUsd);

        (uint amountUsable, uint feesCollected) = IMarketFeeManager(market.feeManager).processFees(
            msg.sender,
            marketId,
            amountUsd,
            synthetix
        );
        // approve to this market prior to transferring to market manager (i.e collect fees)
        uint currentPrice = _getCurrentPrice(marketId);
        uint amountToMint = amountUsable.divDecimal(currentPrice);
        market.synth.mint(msg.sender, amountToMint);

        IMarketManagerModule(synthetix).depositUsd(marketId, address(this), amountUsable);
        emit SynthBought(marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint marketId, uint sellAmount) external override returns (uint) {
        uint currentPrice = _getCurrentPrice(marketId);
        uint amountToWithdraw = sellAmount.mulDecimal(currentPrice);

        MarketSynth storage market = marketSynths[marketId];
        market.synth.burn(msg.sender, sellAmount);

        IMarketManagerModule(synthetix).withdrawUsd(marketId, address(this), amountToWithdraw);
        (uint returnAmount, uint feesCollected) = _manageFees(marketId, amountToWithdraw);

        usdToken.transfer(msg.sender, returnAmount);
        emit SynthSold(marketId, returnAmount, feesCollected);

        return returnAmount;
    }

    function _manageFees(uint marketId, uint amountUsd) internal returns (uint, uint) {
        MarketSynth storage market = marketSynths[marketId];
        usdToken.approve(market.feeManager, amountUsd);
        return IMarketFeeManager(market.feeManager).processFees(msg.sender, marketId, amountUsd, synthetix);
    }

    // TODO: interact with OracleManager to get price for market synth
    function _getCurrentPrice(uint marketId) internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }
}
