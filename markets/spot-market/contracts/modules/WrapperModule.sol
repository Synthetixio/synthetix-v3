//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "../interfaces/IWrapper.sol";
import "../storage/WrapperStorage.sol";
import "../mixins/FeeMixin.sol";
import "../mixins/PriceMixin.sol";
import "../mixins/SynthMixin.sol";

contract WrapperModule is IWrapper, SynthMixin, FeeMixin, PriceMixin, WrapperStorage, OwnableMixin {
    error WrappingNotInitialized();

    modifier onlyEnabledWrapper() {
        if (!_wrapperStore().wrappingEnabled) revert WrappingNotInitialized();

        _;
    }

    function initializeWrapper(uint supplyCap, address collateralType) external override onlyOwner {
        // check if collateral type is supported?
        WrapperStore storage wrapperStore = _wrapperStore();
        SpotMarketStore storage spotMarketStore = _spotMarketStore();
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
        SpotMarketStore storage store = _spotMarketStore();
        // set supply cap on market collateral module
        IMarketCollateralModule(store.synthetix).configureMaximumMarketCollateral(
            store.marketId,
            store.wrapper.collateralType,
            supplyCap
        );

        emit WrapperSupplyUpdated(store.marketId, supplyCap);
    }

    function wrap(uint wrapAmount) external override onlyEnabledWrapper returns (uint amountToMint) {
        SpotMarketStore storage store = _spotMarketStore();
        WrapperStore storage wrapperStore = _wrapperStore();

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
        SpotMarketStore storage store = _spotMarketStore();

        if (balanceOf(msg.sender) < unwrapAmount) revert InsufficientFunds();
        uint allowance = allowance(msg.sender, address(this));
        if (allowance < unwrapAmount) revert InsufficientAllowance(unwrapAmount, allowance);

        uint unwrapAmountInUsd = _synthUsdExchangeRate(unwrapAmount);
        (uint returnAmount, uint feesCollected) = _processFees(store, unwrapAmountInUsd, ISpotMarketFee.TradeType.UNWRAP);

        amountToWithdraw = _usdSynthExchangeRate(returnAmount);

        IMarketCollateralModule(store.synthetix).withdrawMarketCollateral(
            store.marketId,
            _wrapperStore().collateralType,
            amountToWithdraw
        );
        transfer(msg.sender, amountToWithdraw);

        emit SynthUnwrapped(store.marketId, amountToWithdraw, feesCollected);
    }

    function getWrapQuote(uint wrapAmount) external view returns (uint, uint) {
        return _wrapQuote(wrapAmount, ISpotMarketFee.TradeType.WRAP);
    }

    function getUnwrapQuote(uint unwrapAmount) external view returns (uint, uint) {
        return _wrapQuote(unwrapAmount, ISpotMarketFee.TradeType.UNWRAP);
    }

    function _wrapQuote(uint amount, ISpotMarketFee.TradeType tradeType) internal view returns (uint, uint) {
        uint usdAmount = _synthUsdExchangeRate(amount);
        (uint returnAmount, uint feesCollected) = _quote(usdAmount, tradeType);
        return (_usdSynthExchangeRate(returnAmount), feesCollected);
    }
}
