//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../storage/SpotMarketFactory.sol";
import "../storage/FeeConfiguration.sol";
import "../interfaces/IWrapperModule.sol";
import "../storage/Wrapper.sol";
import "../storage/Price.sol";
import "../utils/SynthUtil.sol";
import "../utils/FeeUtil.sol";

/**
 * @title Module for wrapping and unwrapping collateral for synths.
 * @dev See IWrapperModule.
 */
contract WrapperModule is IWrapperModule {
    using DecimalMath for uint256;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using Price for Price.Data;
    using Wrapper for Wrapper.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    /**
     * @inheritdoc IWrapperModule
     */
    function setWrapper(
        uint128 marketId,
        address collateralType,
        uint256 supplyCap
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        Wrapper.update(marketId, collateralType, supplyCap);

        emit WrapperSet(marketId, collateralType, supplyCap);
    }

    /**
     * @inheritdoc IWrapperModule
     */
    function wrap(
        uint128 marketId,
        uint256 wrapAmount
    ) external override returns (uint256 amountToMint) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        store.isValidMarket(marketId);
        wrapperStore.isValidWrapper();

        IERC20 wrappingCollateral = IERC20(wrapperStore.collateralType);

        if (wrappingCollateral.balanceOf(msg.sender) < wrapAmount) revert InsufficientFunds();
        if (wrappingCollateral.allowance(msg.sender, address(this)) < wrapAmount)
            revert InsufficientAllowance(
                wrapAmount,
                store.usdToken.allowance(msg.sender, address(this))
            );

        uint currentDepositedCollateral = IMarketCollateralModule(store.synthetix)
            .getMarketCollateralAmount(marketId, wrapperStore.collateralType);

        // revert when wrapping more than the supply cap
        if (currentDepositedCollateral + wrapAmount > wrapperStore.supplyCap) {
            revert WrapperExceedsSupplyCap(
                wrapperStore.supplyCap,
                currentDepositedCollateral,
                wrapAmount
            );
        }

        // safe transfer?
        wrappingCollateral.transferFrom(msg.sender, address(this), wrapAmount);
        wrappingCollateral.approve(store.synthetix, wrapAmount);
        IMarketCollateralModule(store.synthetix).depositMarketCollateral(
            marketId,
            wrapperStore.collateralType,
            wrapAmount
        );

        uint256 wrapAmountInUsd = Price.synthUsdExchangeRate(
            marketId,
            wrapAmount,
            SpotMarketFactory.TransactionType.WRAP
        );

        (uint256 returnAmountUsd, int256 totalFees) = FeeUtil.calculateFees(
            marketId,
            msg.sender,
            wrapAmountInUsd,
            SpotMarketFactory.TransactionType.WRAP
        );

        uint collectedFees = 0;
        if (totalFees > 0) {
            // TODO: potential gas consideration:
            // currently we withdraw fees amount from market to send to fee collector
            // whatever is leftover gets re-deposited into the market manager.
            // we should consolidate this and only withdraw the amount required
            IMarketManagerModule(store.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );
            collectedFees = FeeUtil.collectFees(marketId, totalFees.toUint());
        }

        amountToMint = Price.usdSynthExchangeRate(
            marketId,
            returnAmountUsd,
            SpotMarketFactory.TransactionType.WRAP
        );

        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint);

        emit SynthWrapped(marketId, amountToMint, totalFees, collectedFees);
    }

    /**
     * @inheritdoc IWrapperModule
     */
    function unwrap(
        uint128 marketId,
        uint256 unwrapAmount
    ) external override returns (uint256 returnCollateralAmount) {
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        store.isValidMarket(marketId);
        wrapperStore.isValidWrapper();

        ITokenModule synth = SynthUtil.getToken(marketId);

        if (synth.balanceOf(msg.sender) < unwrapAmount) revert InsufficientFunds();
        uint256 allowance = synth.allowance(msg.sender, address(this));
        if (allowance < unwrapAmount) revert InsufficientAllowance(unwrapAmount, allowance);

        // transfer from seller
        synth.transferFrom(msg.sender, address(this), unwrapAmount);

        uint256 unwrapAmountInUsd = Price.synthUsdExchangeRate(
            marketId,
            unwrapAmount,
            SpotMarketFactory.TransactionType.UNWRAP
        );
        (uint256 returnAmountUsd, int256 totalFees) = FeeUtil.calculateFees(
            marketId,
            msg.sender,
            unwrapAmountInUsd,
            SpotMarketFactory.TransactionType.UNWRAP
        );

        uint collectedFees = 0;
        if (totalFees > 0) {
            IMarketManagerModule(store.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );
            collectedFees = FeeUtil.collectFees(marketId, totalFees.toUint());
        }

        returnCollateralAmount = Price.usdSynthExchangeRate(
            marketId,
            returnAmountUsd,
            SpotMarketFactory.TransactionType.UNWRAP
        );

        IMarketCollateralModule(store.synthetix).withdrawMarketCollateral(
            marketId,
            wrapperStore.collateralType,
            returnCollateralAmount
        );

        ITokenModule(wrapperStore.collateralType).transfer(msg.sender, returnCollateralAmount);
        synth.burn(address(this), unwrapAmount);

        emit SynthUnwrapped(marketId, returnCollateralAmount, totalFees, collectedFees);
    }
}
