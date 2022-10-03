//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "../interfaces/ISpotMarket.sol";
import "../interfaces/external/IMarketFee.sol";
import "../storage/SpotMarketStorage.sol";

contract SpotMarketModule is ISpotMarket, SpotMarketStorage, OwnableMixin, AssociatedSystemsModule {
    using MathUtil for uint256;

    error InsufficientFunds();
    error InsufficientAllowance();

    function setExternalSystems(address snxAddress, address usdTokenAddress) external onlyOwner {
        SpotMarketStore storage store = _spotMarketStore();

        store.synthetix = snxAddress;
        store.usdToken = ITokenModule(usdTokenAddress);
    }

    function registerSynth(
        string memory name,
        string memory symbol,
        uint8 decimals,
        address priceFeed,
        address feeManager
    ) external override onlyOwner returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        bytes32 tokenId = bytes32(abi.encodePacked(name, symbol));
        address synthImpl = address(new Synth());

        IAssociatedSystemsModule synthFactory = IAssociatedSystemsModule(address(this));
        synthFactory.initOrUpgradeToken(tokenId, name, symbol, decimals, synthImpl);
        (address synthProxyAddress, ) = synthFactory.getAssociatedSystem(tokenId);

        uint synthMarketId = IMarketManagerModule(store.synthetix).registerMarket(address(this));
        MarketSynth memory synth = MarketSynth(ITokenModule(synthProxyAddress), priceFeed, feeManager, synthMarketId);
        store.marketSynths[synthMarketId] = synth;

        emit SynthRegistered(synthMarketId, synthProxyAddress);

        return synthMarketId;
    }

    function getMarket(uint marketId) external view override returns (MarketSynth memory) {
        return _spotMarketStore().marketSynths[marketId];
    }

    // TODO: interact with OracleManager to get price for market synth
    function getSynthPrice(uint marketId) external pure override returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return _getCurrentPrice(marketId);
    }

    /* should this accept marketId as a param */
    function reportedDebt(uint marketId) external view override returns (uint) {
        MarketSynth storage market = _spotMarketStore().marketSynths[marketId];
        return market.synth.totalSupply().mulDecimal(_getCurrentPrice(marketId));
    }

    function updateFeeManager(uint marketId, address newFeeManager) external override onlyOwner {
        _spotMarketStore().marketSynths[marketId].feeManager = newFeeManager;
    }

    function exchange(
        uint fromMarketId,
        uint toMarketId,
        uint amount
    ) external override returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        MarketSynth storage fromMarket = store.marketSynths[fromMarketId];
        MarketSynth storage toMarket = store.marketSynths[toMarketId];

        uint amountUsd = _synthUsdExchangeRate(fromMarketId, amount);

        // transfer funds into contract (required for collecting fees)
        IMarketManagerModule(store.synthetix).withdrawUsd(fromMarketId, address(this), amountUsd);
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
        SpotMarketStore storage store = _spotMarketStore();

        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (store.usdToken.allowance(msg.sender, address(this)) < amountUsd) {
            revert InsufficientAllowance();
        }

        MarketSynth storage market = store.marketSynths[marketId];

        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (uint amountUsable, uint feesCollected) = _manageFees(market, amountUsd);

        uint amountToMint = _usdSynthExchangeRate(marketId, amountUsable);
        market.synth.mint(msg.sender, amountToMint);

        // check with db on market manager to check for msg sender being the target
        store.usdToken.approve(address(this), amountUsable); // required for market manager
        IMarketManagerModule(store.synthetix).depositUsd(marketId, address(this), amountUsable);

        emit SynthBought(marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint marketId, uint sellAmount) external override returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        uint amountToWithdraw = _synthUsdExchangeRate(marketId, sellAmount);

        MarketSynth storage market = store.marketSynths[marketId];
        market.synth.burn(msg.sender, sellAmount);

        IMarketManagerModule(store.synthetix).withdrawUsd(marketId, address(this), amountToWithdraw);
        (uint returnAmount, uint feesCollected) = _manageFees(market, amountToWithdraw);

        store.usdToken.transfer(msg.sender, returnAmount);
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
        _spotMarketStore().usdToken.approve(market.feeManager, amountUsd);
        return IMarketFee(market.feeManager).processFees(msg.sender, market.marketId, amountUsd);
    }

    // TODO: interact with OracleManager to get price for market synth
    function _getCurrentPrice(uint marketId) internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }
}
