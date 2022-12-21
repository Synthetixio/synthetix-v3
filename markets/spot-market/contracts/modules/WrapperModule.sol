//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/IWrapperModule.sol";
import "../storage/Wrapper.sol";
import "../storage/Price.sol";
import "../utils/SynthUtil.sol";

contract WrapperModule is IWrapperModule {
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
    ) external override returns (uint256 amountToMint) {
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

        uint256 wrapAmountInUsd = Price.synthUsdExchangeRate(
            marketId,
            wrapAmount,
            SpotMarketFactory.TransactionType.WRAP
        );
        (uint256 returnAmount, int256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            wrapAmountInUsd,
            SpotMarketFactory.TransactionType.WRAP
        );

        // TODO: check int256
        amountToMint = Price.usdSynthExchangeRate(
            marketId,
            returnAmount,
            SpotMarketFactory.TransactionType.WRAP
        );

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
        uint256 unwrapAmount
    ) external override returns (uint256 amountToWithdraw) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        wrapperStore.onlyEnabledWrapper();

        ITokenModule synth = SynthUtil.getToken(marketId);

        if (synth.balanceOf(msg.sender) < unwrapAmount) revert InsufficientFunds();
        uint256 allowance = synth.allowance(msg.sender, address(this));
        if (allowance < unwrapAmount) revert InsufficientAllowance(unwrapAmount, allowance);

        uint256 unwrapAmountInUsd = Price.synthUsdExchangeRate(
            marketId,
            unwrapAmount,
            SpotMarketFactory.TransactionType.UNWRAP
        );
        (uint256 returnAmount, int256 feesCollected) = Fee.calculateFees(
            marketId,
            msg.sender,
            unwrapAmountInUsd,
            SpotMarketFactory.TransactionType.UNWRAP
        );

        // TODO: check int256
        amountToWithdraw = Price.usdSynthExchangeRate(
            marketId,
            returnAmount,
            SpotMarketFactory.TransactionType.UNWRAP
        );

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
