//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC20} from "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import {SafeCastU256, SafeCastI256} from "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import {SpotMarketFactory} from "../storage/SpotMarketFactory.sol";
import {IWrapperModule} from "../interfaces/IWrapperModule.sol";
import {OrderFees} from "../storage/OrderFees.sol";
import {Transaction} from "../utils/TransactionUtil.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {Wrapper} from "../storage/Wrapper.sol";
import {Price} from "../storage/Price.sol";
import {MarketConfiguration} from "../storage/MarketConfiguration.sol";
import {SynthUtil} from "../utils/SynthUtil.sol";

/**
 * @title Module for wrapping and unwrapping collateral for synths.
 * @dev See IWrapperModule.
 */
contract WrapperModule is IWrapperModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using MarketConfiguration for MarketConfiguration.Data;
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
        uint256 wrapAmount,
        uint256 minAmountReceived
    ) external override returns (uint256 amountToMint, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        spotMarketFactory.isValidMarket(marketId);
        wrapperStore.isValidWrapper();

        IERC20 wrappingCollateral = IERC20(wrapperStore.wrapCollateralType);
        uint256 wrapAmountD18 = Price
            .scale(wrapAmount.toInt(), wrappingCollateral.decimals())
            .toUint();

        // revert when wrapping more than the supply cap
        wrapperStore.checkMaxWrappableAmount(marketId, wrapAmountD18, spotMarketFactory.synthetix);

        wrappingCollateral.transferFrom(msg.sender, address(this), wrapAmount);
        wrappingCollateral.approve(address(spotMarketFactory.synthetix), wrapAmount);
        spotMarketFactory.synthetix.depositMarketCollateral(
            marketId,
            wrapperStore.wrapCollateralType,
            wrapAmount
        );

        MarketConfiguration.Data storage config;
        (amountToMint, fees, config) = MarketConfiguration.quoteWrap(
            marketId,
            wrapAmountD18,
            Price.getCurrentPrice(marketId, Transaction.Type.WRAP)
        );

        if (amountToMint < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, amountToMint);
        }

        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            address(0),
            spotMarketFactory,
            Transaction.Type.WRAP
        );

        SynthUtil.getToken(marketId).mint(msg.sender, amountToMint);

        emit SynthWrapped(marketId, amountToMint, fees, collectedFees);
    }

    /**
     * @inheritdoc IWrapperModule
     */
    function unwrap(
        uint128 marketId,
        uint256 unwrapAmount,
        uint256 minAmountReceived
    ) external override returns (uint256 returnCollateralAmount, OrderFees.Data memory fees) {
        SpotMarketFactory.Data storage spotMarketFactory = SpotMarketFactory.load();
        Wrapper.Data storage wrapperStore = Wrapper.load(marketId);
        spotMarketFactory.isValidMarket(marketId);
        wrapperStore.isValidWrapper();

        ITokenModule synth = SynthUtil.getToken(marketId);

        // transfer and burn from seller
        synth.transferFrom(msg.sender, address(this), unwrapAmount);
        synth.burn(address(this), unwrapAmount);

        MarketConfiguration.Data storage config;
        uint256 returnCollateralAmountD18;
        (returnCollateralAmountD18, fees, config) = MarketConfiguration.quoteUnwrap(
            marketId,
            unwrapAmount,
            Price.getCurrentPrice(marketId, Transaction.Type.UNWRAP)
        );

        uint8 collateralDecimals = ITokenModule(wrapperStore.wrapCollateralType).decimals();

        returnCollateralAmount = Price
            .scaleTo(returnCollateralAmountD18.toInt(), collateralDecimals)
            .toUint();

        if (returnCollateralAmount < minAmountReceived) {
            revert InsufficientAmountReceived(minAmountReceived, returnCollateralAmount);
        }
        uint256 collectedFees = config.collectFees(
            marketId,
            fees,
            msg.sender,
            address(0),
            spotMarketFactory,
            Transaction.Type.UNWRAP
        );

        spotMarketFactory.synthetix.withdrawMarketCollateral(
            marketId,
            wrapperStore.wrapCollateralType,
            returnCollateralAmount
        );

        ITokenModule(wrapperStore.wrapCollateralType).transfer(msg.sender, returnCollateralAmount);

        emit SynthUnwrapped(marketId, returnCollateralAmount, fees, collectedFees);
    }
}
