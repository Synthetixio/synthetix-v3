//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "../interfaces/IWrapper.sol";
import "../storage/Wrapper.sol";
import "../storage/SpotMarket.sol";
import "../helpers/FeeHelper.sol";
import "../helpers/PriceHelper.sol";
import "../helpers/SynthHelper.sol";

contract WrapperModule is IWrapper, SynthHelper, PriceHelper, FeeHelper {
    error WrappingNotInitialized();

    modifier onlyEnabledWrapper() {
        if (!Wrapper.load().wrappingEnabled) revert WrappingNotInitialized();

        _;
    }

    function initializeWrapper(uint supplyCap, address collateralType) external override onlyOwner {
        // check if collateral type is supported?
        Wrapper.Data storage wrapperStore = Wrapper.load();
        SpotMarket.Data storage spotMarketStore = SpotMarket.load();
        // store supported collateral type
        wrapperStore.collateralType = collateralType;
        wrapperStore.wrappingEnabled = true;

        // set supply cap on market collateral module
        IMarketCollateralModule(spotMarketStore.synthetix).configureMaximumMarketCollateral(
            spotMarketStore.marketId,
            collateralType,
            supplyCap
        );

        emit WrapperInitialized(spotMarketStore.marketId, collateralType, supplyCap);
    }

    function updateSupplyCap(uint supplyCap) external override onlyOwner {
        SpotMarket.Data storage spotMarketStore = SpotMarket.load();
        // set supply cap on market collateral module
        IMarketCollateralModule(store.synthetix).configureMaximumMarketCollateral(
            store.marketId,
            _wrapperStore().collateralType,
            supplyCap
        );

        emit WrapperSupplyUpdated(store.marketId, supplyCap);
    }

    function wrap(uint wrapAmount) external override onlyEnabledWrapper returns (uint amountToMint) {
        Wrapper.Data storage wrapperStore = Wrapper.load();

        IERC20 wrappingCollateral = IERC20(wrapperStore.collateralType);

        if (wrappingCollateral.balanceOf(msg.sender) < wrapAmount) revert InsufficientFunds();
        if (wrappingCollateral.allowance(msg.sender, address(this)) < wrapAmount)
            revert InsufficientAllowance(wrapAmount, store.usdToken.allowance(msg.sender, address(this)));

        // safe transfer?
        wrappingCollateral.transferFrom(msg.sender, address(this), wrapAmount);

        uint wrapAmountInUsd = _synthUsdExchangeRate(wrapAmount);
        (uint returnAmount, uint feesCollected) = _processFees(store, wrapAmountInUsd, ISpotMarketFee.TradeType.WRAP);

        amountToMint = _usdSynthExchangeRate(returnAmount);

        store.usdToken.approve(store.synthetix, amountToMint);
        IMarketCollateralModule(store.synthetix).depositMarketCollateral(store.marketId, address(this), amountToMint);

        _mint(msg.sender, amountToMint);

        emit SynthWrapped(store.marketId, amountToMint, feesCollected);
    }

    function unwrap(uint unwrapAmount) external override onlyEnabledWrapper returns (uint amountToWithdraw) {
        Wrapper.Data storage wrapperStore = Wrapper.load();

        if (_getBalanceOf(msg.sender) < unwrapAmount) revert InsufficientFunds();
        uint allowance = _getAllowance(msg.sender, address(this));
        if (allowance < unwrapAmount) revert InsufficientAllowance(unwrapAmount, allowance);

        uint unwrapAmountInUsd = _synthUsdExchangeRate(unwrapAmount);
        (uint returnAmount, uint feesCollected) = _processFees(store, unwrapAmountInUsd, ISpotMarketFee.TradeType.UNWRAP);

        amountToWithdraw = _usdSynthExchangeRate(returnAmount);

        IMarketCollateralModule(store.synthetix).withdrawMarketCollateral(
            store.marketId,
            wrapperStore.collateralType,
            amountToWithdraw
        );
        ITokenModule(wrapperStore.collateralType).transfer(msg.sender, amountToWithdraw);
        _burn(msg.sender, unwrapAmount);

        emit SynthUnwrapped(store.marketId, amountToWithdraw, feesCollected);
    }

    function getWrapQuote(uint wrapAmount) external view returns (uint, uint) {
        return _wrapperQuote(wrapAmount, ISpotMarketFee.TradeType.WRAP);
    }

    function getUnwrapQuote(uint unwrapAmount) external view returns (uint, uint) {
        return _wrapperQuote(unwrapAmount, ISpotMarketFee.TradeType.UNWRAP);
    }

    function _wrapperQuote(uint amount, ISpotMarketFee.TradeType tradeType) internal view returns (uint, uint) {
        uint usdAmount = _synthUsdExchangeRate(amount);
        (uint returnAmount, uint feesCollected) = _quote(_spotMarketStore(), usdAmount, tradeType);
        return (_usdSynthExchangeRate(returnAmount), feesCollected);
    }
}
