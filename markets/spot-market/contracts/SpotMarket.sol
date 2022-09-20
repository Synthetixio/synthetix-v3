//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/main/contracts/interfaces/IUSDTokenModule.sol";
import "./Synth.sol";

contract SpotMarket is IMarket {
    using MathUtil for uint256;

    struct MarketSynth {
        Synth synth;
        address priceFeed;
        address feeManager;
    }

    IERC20 public usdToken;
    address public synthetix;

    mapping(uint => MarketSynth) public marketSynths;

    constructor(address snxAddress) {
        synthetix = snxAddress;
        usdToken = IERC20(IUSDTokenModule(synthetix).getUSDTokenAddress());
    }

    /* TODO: 
        - make it ownable
        - revert if synth exists
        
    */
    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address priceFeed,
        address feeManager
    ) external returns (uint) {
        Synth newSynth = new Synth(address(this), name, symbol, decimals);
        uint synthMarketId = IMarketManagerModule(synthetix).registerMarket(address(this));
        MarketSynth memory synth = MarketSynth(newSynth, priceFeed, feeManager);
        marketSynths[synthMarketId] = synth;

        return synthMarketId;
    }

    /* should this accept marketId as a param */
    function reportedDebt(uint marketId) external view override returns (uint) {
        MarketSynth storage market = marketSynths[marketId];
        return market.synth.totalSupply().mulDecimal(_getCurrentPrice(marketId));
    }

    /*
        Should depositUsd have msg.sender as a parameter or assume it's always the market transferring the amount?
        The alternative is to have the user approve the transfer to market manager.

        The scenario to consider is when markets collect fees.  what's the transfer mechanism?  What should user be approving?
    */
    /*
        TODO:
        - check snxUSD approve balance for current address
        - balance checks for amountUsd
    */
    function buy(uint marketId, uint amountUsd) external {
        // approve to this market prior to transferring to market manager (i.e collect fees)
        uint currentPrice = _getCurrentPrice(marketId);
        uint amountToMint = amountUsd.divDecimal(currentPrice);

        MarketSynth storage market = marketSynths[marketId];
        market.synth.mint(msg.sender, amountToMint);

        // approve to fee manager
        // example
        /*
            Fee = 20% example
            100 USD 
            approve 100 USD to fee manager
            call chargeFee(100 USD)
                - fee manager charges 10 USD
                - returns value 10 USD 
            deposit 10 USD
            balanceOf(this) = 80 USD
            mint (80USD worth of synth)
            deposit 80 USD
        */
        // uint amountLeft = feeManager.chargeFee(msg.sender, amountUsd);

        usdToken.transferFrom(msg.sender, address(this), amountUsd);
        IMarketManagerModule(synthetix).depositUsd(marketId, address(this), amountUsd);
        // emit event
    }

    /*
        TODO:
        - check snxUSD approve balance for current address
        - balance checks for sellAmount
    */
    function sell(uint marketId, uint sellAmount) external {
        uint currentPrice = _getCurrentPrice(marketId);
        uint amountToWithdraw = sellAmount.mulDecimal(currentPrice);

        MarketSynth storage market = marketSynths[marketId];
        market.synth.burn(msg.sender, sellAmount);

        IMarketManagerModule(synthetix).withdrawUsd(marketId, msg.sender, amountToWithdraw);
        // emit event
    }

    // TODO: OracleManager
    // price / status of market (closed due to circuit breaker)
    function _getCurrentPrice(uint synthId) internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }
}
