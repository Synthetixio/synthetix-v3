//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/IWrapper.sol";
import "../storage/Wrapper.sol";
import "../storage/Price.sol";
import "../utils/SynthUtil.sol";

contract WrapperModule is IWrapper {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;
    using Wrapper for Wrapper.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    function initializeWrapper(uint128 marketId, address collateralType) external override {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        store.onlyMarketOwner(marketId);

        Wrapper.create(marketId, collateralType);

        IMarketCollateralModule(store.synthetix).configureMaximumMarketCollateral(
            marketId,
            collateralType,
            type(uint256).max // TODO: add supply cap
        );

        emit WrapperInitialized(marketId, collateralType);
    }

    function wrap(
        uint128 marketId,
        uint256 wrapAmount
    ) external override returns (int256 amountToMint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        wrapperStore.onlyEnabledWrapper();

        IERC20 wrappingCollateral = IERC20(wrapperStore.collateralType);

        if (wrappingCollateral.balanceOf(msg.sender) < wrapAmount) revert InsufficientFunds();
        if (wrappingCollateral.allowance(msg.sender, address(this)) < wrapAmount)
            revert InsufficientAllowance(
                wrapAmount,
                store.usdToken.allowance(msg.sender, address(this))
            );

        // safe transfer?
        wrappingCollateral.transferFrom(msg.sender, address(this), wrapAmount);

        Price.Data storage priceStore = Price.load(marketId);

        int256 wrapAmountInUsd = priceStore.synthUsdExchangeRate(
            wrapAmount.toInt(),
            Fee.TradeType.WRAP
        );
        (int256 returnAmount, uint256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            wrapAmountInUsd,
            Fee.TradeType.WRAP
        );

        store.synthFeesCollected[marketId] += feesCollected;

        // TODO: check int256
        amountToMint = priceStore.usdSynthExchangeRate(returnAmount, Fee.TradeType.WRAP);

        store.usdToken.approve(store.synthetix, amountToMint.toUint());
        IMarketCollateralModule(store.synthetix).depositMarketCollateral(
            marketId,
            address(this),
            amountToMint.toUint()
        );

        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint.toUint());

        emit SynthWrapped(marketId, amountToMint, feesCollected);
    }

    function unwrap(
        uint128 marketId,
        uint256 unwrapAmount
    ) external override returns (int256 amountToWithdraw) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        wrapperStore.onlyEnabledWrapper();

        ITokenModule synth = SynthUtil.getToken(marketId);

        if (synth.balanceOf(msg.sender) < unwrapAmount) revert InsufficientFunds();
        uint256 allowance = synth.allowance(msg.sender, address(this));
        if (allowance < unwrapAmount) revert InsufficientAllowance(unwrapAmount, allowance);

        Price.Data storage priceStore = Price.load(marketId);

        int256 unwrapAmountInUsd = priceStore.synthUsdExchangeRate(
            unwrapAmount.toInt(),
            Fee.TradeType.UNWRAP
        );
        (int256 returnAmount, uint256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            unwrapAmountInUsd,
            Fee.TradeType.UNWRAP
        );

        store.synthFeesCollected[marketId] += feesCollected;

        // TODO: check int256
        amountToWithdraw = priceStore.usdSynthExchangeRate(returnAmount, Fee.TradeType.UNWRAP);

        IMarketCollateralModule(store.synthetix).withdrawMarketCollateral(
            marketId,
            wrapperStore.collateralType,
            amountToWithdraw.toUint()
        );
        ITokenModule(wrapperStore.collateralType).transfer(msg.sender, amountToWithdraw.toUint());
        synth.burn(msg.sender, unwrapAmount);

        emit SynthUnwrapped(marketId, amountToWithdraw, feesCollected);
    }
}
