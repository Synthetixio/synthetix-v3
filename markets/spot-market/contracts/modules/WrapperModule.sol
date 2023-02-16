//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

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
        address wrapCollateralType,
        uint256 maxWrappableAmount
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        Wrapper.update(marketId, wrapCollateralType, maxWrappableAmount);

        emit WrapperSet(marketId, wrapCollateralType, maxWrappableAmount);
    }

    /**
     * @inheritdoc IWrapperModule
     */
    function wrap(
        uint128 marketId,
        uint256 wrapAmount
    ) external override returns (uint256 amountToMint) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        spotMarketFactory.isValidMarket(marketId);
        wrapperStore.isValidWrapper();

        IERC20 wrappingCollateral = IERC20(wrapperStore.wrapCollateralType);

        uint currentDepositedCollateral = IMarketCollateralModule(spotMarketFactory.synthetix)
            .getMarketCollateralAmount(marketId, wrapperStore.wrapCollateralType);

        // revert when wrapping more than the supply cap
        if (currentDepositedCollateral + wrapAmount > wrapperStore.maxWrappableAmount) {
            revert WrapperExceedsMaxAmount(
                wrapperStore.maxWrappableAmount,
                currentDepositedCollateral,
                wrapAmount
            );
        }

        // safe transfer?
        wrappingCollateral.transferFrom(msg.sender, address(this), wrapAmount);
        wrappingCollateral.approve(spotMarketFactory.synthetix, wrapAmount);
        IMarketCollateralModule(spotMarketFactory.synthetix).depositMarketCollateral(
            marketId,
            wrapperStore.wrapCollateralType,
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
            Price.getCurrentPrice(marketId, SpotMarketFactory.TransactionType.WRAP),
            SpotMarketFactory.TransactionType.WRAP
        );

        uint collectedFees;
        if (totalFees > 0) {
            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );
            collectedFees = FeeUtil.collectFees(
                marketId,
                totalFees,
                msg.sender,
                SpotMarketFactory.TransactionType.WRAP
            );
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
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        spotMarketFactory.isValidMarket(marketId);
        wrapperStore.isValidWrapper();

        ITokenModule synth = SynthUtil.getToken(marketId);

        // transfer from seller
        synth.transferFrom(msg.sender, address(this), unwrapAmount);

        // TODO: do i need to transfer to burn?
        synth.burn(address(this), unwrapAmount);

        uint256 unwrapAmountInUsd = Price.synthUsdExchangeRate(
            marketId,
            unwrapAmount,
            SpotMarketFactory.TransactionType.UNWRAP
        );
        (uint256 returnAmountUsd, int256 totalFees) = FeeUtil.calculateFees(
            marketId,
            msg.sender,
            unwrapAmountInUsd,
            Price.getCurrentPrice(marketId, SpotMarketFactory.TransactionType.UNWRAP),
            SpotMarketFactory.TransactionType.UNWRAP
        );

        uint collectedFees = 0;
        if (totalFees > 0) {
            IMarketManagerModule(spotMarketFactory.synthetix).withdrawMarketUsd(
                marketId,
                address(this),
                totalFees.toUint()
            );
            collectedFees = FeeUtil.collectFees(
                marketId,
                totalFees,
                msg.sender,
                SpotMarketFactory.TransactionType.UNWRAP
            );
        }

        returnCollateralAmount = Price.usdSynthExchangeRate(
            marketId,
            returnAmountUsd,
            SpotMarketFactory.TransactionType.UNWRAP
        );

        IMarketCollateralModule(spotMarketFactory.synthetix).withdrawMarketCollateral(
            marketId,
            wrapperStore.wrapCollateralType,
            returnCollateralAmount
        );

        ITokenModule(wrapperStore.wrapCollateralType).transfer(msg.sender, returnCollateralAmount);

        emit SynthUnwrapped(marketId, returnCollateralAmount, totalFees, collectedFees);
    }
}
