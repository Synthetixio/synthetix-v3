//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-modules/contracts/interfaces/IOwnerModule.sol";
import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "../mixins/FeeMixin.sol";
import "../mixins/PriceMixin.sol";
import "../mixins/SpotMarketMixin.sol";
import "../mixins/SynthMixin.sol";
import "../interfaces/ISpotMarket.sol";
import "../interfaces/ISpotMarketFee.sol";

contract SpotMarketModule is
    ISpotMarket,
    SynthMixin,
    SpotMarketMixin,
    FeeMixin,
    PriceMixin,
    OwnableMixin,
    InitializableMixin
{
    using DecimalMath for uint256;

    error IncorrectMarket();

    function _isInitialized() internal view override returns (bool) {
        return _spotMarketStore().initialized;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        address snxAddress,
        address usdTokenAddress,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address feeManager,
        bytes memory buyFeedId,
        bytes memory sellFeedId
    ) external override onlyOwner {
        SpotMarketStore storage store = _spotMarketStore();

        store.synthetix = snxAddress;
        store.usdToken = ITokenModule(usdTokenAddress);

        _initializeToken(tokenName, tokenSymbol, tokenDecimals);

        // register with market manager
        uint128 synthMarketId = IMarketManagerModule(store.synthetix).registerMarket(address(this));
        // set storage
        store.marketId = synthMarketId;
        store.feeManager = feeManager;
        store.priceFeed = PriceFeed(buyFeedId, sellFeedId);

        // emit event
        emit SynthRegistered(synthMarketId);
        // we're initialized
        store.initialized = true;
    }

    /* should this accept marketId as a param */
    function reportedDebt(uint128 marketId) external view override returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();
        if (store.marketId != marketId) {
            revert IncorrectMarket();
        }

        return _getTotalSupply().mulDecimal(_getCurrentPrice());
    }

    function name(uint128 marketId) external view returns (string memory) {
        return string(string.concat(bytes(_getName()), " Spot Market"));
    }

    function getMarketId() external view override returns (uint128) {
        return _spotMarketStore().marketId;
    }

    function updateFeeManager(address newFeeManager) external override onlyOwner {
        _spotMarketStore().feeManager = newFeeManager;
    }

    function updatePriceFeed(PriceFeed memory priceFeed) external override onlyOwner {
        _spotMarketStore().priceFeed = priceFeed;
    }

    function buy(uint amountUsd) external override onlyIfInitialized returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        uint allowance = store.usdToken.allowance(msg.sender, address(this));
        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (allowance < amountUsd) {
            revert InsufficientAllowance(amountUsd, allowance);
        }

        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (uint amountUsable, uint feesCollected) = _processFees(store, amountUsd, ISpotMarketFee.TradeType.BUY);

        uint amountToMint = _usdSynthExchangeRate(amountUsable);
        _mint(msg.sender, amountToMint);

        store.usdToken.approve(address(this), amountUsable);
        IMarketManagerModule(store.synthetix).depositMarketUsd(store.marketId, address(this), amountUsable);

        emit SynthBought(store.marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint sellAmount) external override onlyIfInitialized returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        uint amountToWithdraw = _synthUsdExchangeRate(sellAmount);
        _burn(msg.sender, sellAmount);

        IMarketManagerModule(store.synthetix).withdrawMarketUsd(store.marketId, address(this), amountToWithdraw);

        (uint returnAmount, uint feesCollected) = _processFees(store, amountToWithdraw, ISpotMarketFee.TradeType.SELL);

        store.usdToken.transfer(msg.sender, returnAmount);
        emit SynthSold(store.marketId, returnAmount, feesCollected);

        return returnAmount;
    }

    function getBuyQuote(uint amountUsd) external view override returns (uint, uint) {
        return _quote(_spotMarketStore(), amountUsd, ISpotMarketFee.TradeType.BUY);
    }

    function getSellQuote(uint amountSynth) external view override returns (uint, uint) {
        uint usdAmount = _synthUsdExchangeRate(amountSynth);
        return _quote(_spotMarketStore(), usdAmount, ISpotMarketFee.TradeType.SELL);
    }
}
