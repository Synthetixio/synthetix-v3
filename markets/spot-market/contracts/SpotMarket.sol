//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/main/contracts/interfaces/IUSDTokenModule.sol";
import "./Synth.sol";

/*
    - Setup proxy architecture
    - create synth market function (multiple synths) i.e mapping(uint => address) & mapping(address => PriceFeed)
    - configured fee structure
      - direct integrations (addresses allowed to mint/burn with special permissions)
*/
contract SpotMarket is IMarket {
    using MathUtil for uint256;

    struct MarketSynth {
        address synthAddress;
        uint priceFeed;
    }

    IERC20 public btcToken;
    IERC20 public usdToken;
    uint public marketId;
    address public synthetix;

    address[] public marketSynths;
    mapping(address => MarketSynth) synthDetails;

    constructor(address snxAddress, address btcTokenAddress) {
        synthetix = snxAddress;
        marketId = IMarketManagerModule(synthetix).registerMarket(address(this));
        usdToken = IERC20(IUSDTokenModule(synthetix).getUSDTokenAddress());
        btcToken = IERC20(btcTokenAddress);
    }

    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) external {
        Synth newSynth = new Synth(address(this), name, symbol, decimals);
        MarketSynth synth = new MarketSynth(address(newSynth), )
        marketSynths.push(address(newSynth));
    }

    /* should this accept marketId as a param */
    function reportedDebt() external view override returns (uint) {
        uint currentPrice = _getCurrentPrice();
        // TODO: decimals
        return btcToken.balanceOf(address(this)).mulDecimal(currentPrice);
    }

    /*
        Should depositUsd have msg.sender as a parameter or assume it's always the market transferring the amount?
        The alternative is to have the user approve the transfer to market manager.

        The scenario to consider is when markets collect fees.  what's the transfer mechanism?  What should user be approving?
    */
    function buy(uint amountUsd) external {
        // approve to this market prior to transferring to market manager (i.e collect fees)
        uint currentPrice = _getCurrentPrice();
        uint amountToMint = amountUsd.divDecimal(currentPrice);

        btcToken.mint(msg.sender, amountToMint);
        usdToken.transferFrom(msg.sender, address(this), amountUsd);
        IMarketManagerModule(synthetix).depositUsd(marketId, address(this), amountUsd);
        // emit event
    }

    function sell(uint amountBtc) external {
        uint currentPrice = _getCurrentPrice();
        uint amountToWithdraw = amountBtc.mulDecimal(currentPrice);

        btcToken.burn(msg.sender, amountBtc);
        IMarketManagerModule(synthetix).withdrawUsd(marketId, msg.sender, amountToWithdraw);
        // emit event
    }

    function _getCurrentPrice() internal view returns (uint) {
        /* get from oracleManager / aggregator chainlink */
        return 1;
    }
}
