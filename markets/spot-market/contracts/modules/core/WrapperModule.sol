//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "../../storage/SpotMarketFactory.sol";
import "../../interfaces/IWrapper.sol";
import "../../storage/Wrapper.sol";
import "../../storage/Price.sol";
import "../../utils/SynthUtil.sol";

contract WrapperModule is IWrapper {
    using MathUtil for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Fee for Fee.Data;
    using Wrapper for Wrapper.Data;

    function initializeWrapper(uint128 marketId, address collateralType) external override {
        OwnableStorage.onlyOwner();
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        store.synthConfigs[marketId].wrapperData = Wrapper.Data(collateralType, true);

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
    ) external override returns (uint256 amountToMint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = store.getWrapperData(marketId);
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

        Price.Data storage priceStore = store.getPriceData(marketId);

        uint256 wrapAmountInUsd = priceStore.synthUsdExchangeRate(wrapAmount);
        (uint256 returnAmount, uint256 feesCollected) = store.getFeeData(marketId).calculateFees(
            msg.sender,
            wrapAmountInUsd,
            Fee.TradeType.WRAP
        );

        store.synthFeesCollected[marketId] += feesCollected;

        amountToMint = priceStore.usdSynthExchangeRate(returnAmount);

        store.usdToken.approve(store.synthetix, amountToMint);
        IMarketCollateralModule(store.synthetix).depositMarketCollateral(
            marketId,
            address(this),
            amountToMint
        );

        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint);

        emit SynthWrapped(marketId, amountToMint, feesCollected);
    }

    function unwrap(
        uint128 marketId,
        uint unwrapAmount
    ) external override returns (uint amountToWithdraw) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = store.getWrapperData(marketId);
        wrapperStore.onlyEnabledWrapper();

        ITokenModule synth = SynthUtil.getToken(marketId);

        if (synth.balanceOf(msg.sender) < unwrapAmount) revert InsufficientFunds();
        uint256 allowance = synth.allowance(msg.sender, address(this));
        if (allowance < unwrapAmount) revert InsufficientAllowance(unwrapAmount, allowance);

        Price.Data storage priceStore = store.getPriceData(marketId);

        uint256 unwrapAmountInUsd = priceStore.synthUsdExchangeRate(unwrapAmount);
        (uint256 returnAmount, uint256 feesCollected) = store.getFeeData(marketId).calculateFees(
            msg.sender,
            unwrapAmountInUsd,
            Fee.TradeType.UNWRAP
        );

        store.synthFeesCollected[marketId] += feesCollected;

        amountToWithdraw = priceStore.usdSynthExchangeRate(returnAmount);

        IMarketCollateralModule(store.synthetix).withdrawMarketCollateral(
            marketId,
            wrapperStore.collateralType,
            amountToWithdraw
        );
        ITokenModule(wrapperStore.collateralType).transfer(msg.sender, amountToWithdraw);
        synth.burn(msg.sender, unwrapAmount);

        emit SynthUnwrapped(marketId, amountToWithdraw, feesCollected);
    }
}
