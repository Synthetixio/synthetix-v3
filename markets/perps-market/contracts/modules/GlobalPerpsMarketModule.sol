//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {DecimalMath} from "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import {ERC165Helper} from "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";
import {SetUtil} from "@synthetixio/core-contracts/contracts/utils/SetUtil.sol";
import {IFeeCollector} from "../interfaces/external/IFeeCollector.sol";
import {GlobalPerpsMarketConfiguration} from "../storage/GlobalPerpsMarketConfiguration.sol";
import {GlobalPerpsMarket} from "../storage/GlobalPerpsMarket.sol";
import {IGlobalPerpsMarketModule} from "../interfaces/IGlobalPerpsMarketModule.sol";
import {OwnableStorage} from "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

/**
 * @title Module for global Perps Market settings.
 * @dev See IGlobalPerpsMarketModule.
 */
contract GlobalPerpsMarketModule is IGlobalPerpsMarketModule {
    using SetUtil for SetUtil.UintSet;
    using GlobalPerpsMarketConfiguration for GlobalPerpsMarketConfiguration.Data;
    using GlobalPerpsMarket for GlobalPerpsMarket.Data;

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setMaxCollateralAmount(
        uint128 synthMarketId,
        uint collateralAmount
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxCollateralAmounts[synthMarketId] = collateralAmount;

        emit MaxCollateralAmountSet(synthMarketId, collateralAmount);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getMaxCollateralAmount(uint128 synthMarketId) external view override returns (uint) {
        return GlobalPerpsMarketConfiguration.load().maxCollateralAmounts[synthMarketId];
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setSynthDeductionPriority(
        uint128[] memory newSynthDeductionPriority
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.load().updateSynthDeductionPriority(
            newSynthDeductionPriority
        );

        emit SynthDeductionPrioritySet(newSynthDeductionPriority);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getSynthDeductionPriority() external view override returns (uint128[] memory) {
        return GlobalPerpsMarketConfiguration.load().synthDeductionPriority;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setLiquidationRewardGuards(
        uint256 minLiquidationRewardUsd,
        uint256 maxLiquidationRewardUsd
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.minLiquidationRewardUsd = minLiquidationRewardUsd;
        store.maxLiquidationRewardUsd = maxLiquidationRewardUsd;

        emit LiquidationRewardGuardsSet(minLiquidationRewardUsd, maxLiquidationRewardUsd);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getLiquidationRewardGuards()
        external
        view
        override
        returns (uint256 minLiquidationRewardUsd, uint256 maxLiquidationRewardUsd)
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        minLiquidationRewardUsd = store.minLiquidationRewardUsd;
        maxLiquidationRewardUsd = store.maxLiquidationRewardUsd;
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function totalGlobalCollateralValue()
        external
        view
        override
        returns (uint256 totalCollateralValue)
    {
        return GlobalPerpsMarket.load().totalCollateralValue();
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setFeeCollector(address feeCollector) external override {
        OwnableStorage.onlyOwner();
        if (feeCollector != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(feeCollector, type(IFeeCollector).interfaceId)
            ) {
                revert InvalidFeeCollectorInterface(feeCollector);
            }
        }

        GlobalPerpsMarketConfiguration.load().feeCollector = IFeeCollector(feeCollector);
        emit FeeCollectorSet(feeCollector);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getFeeCollector() external view override returns (address feeCollector) {
        return address(GlobalPerpsMarketConfiguration.load().feeCollector);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function updateReferrerShare(address referrer, uint256 shareRatioD18) external override {
        OwnableStorage.onlyOwner();

        if (shareRatioD18 > DecimalMath.UNIT) {
            revert InvalidReferrerShareRatio(shareRatioD18);
        }

        GlobalPerpsMarketConfiguration.load().referrerShare[referrer] = shareRatioD18;

        emit ReferrerShareUpdated(referrer, shareRatioD18);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getReferrerShare(
        address referrer
    ) external view override returns (uint256 shareRatioD18) {
        return GlobalPerpsMarketConfiguration.load().referrerShare[referrer];
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getMarkets() external view override returns (uint256[] memory marketIds) {
        marketIds = GlobalPerpsMarket.load().activeMarkets.values();
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function setPerAccountCaps(
        uint128 maxPositionsPerAccount,
        uint128 maxCollateralsPerAccount
    ) external override {
        OwnableStorage.onlyOwner();
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        store.maxPositionsPerAccount = maxPositionsPerAccount;
        store.maxCollateralsPerAccount = maxCollateralsPerAccount;

        emit PerAccountCapsSet(maxPositionsPerAccount, maxCollateralsPerAccount);
    }

    /**
     * @inheritdoc IGlobalPerpsMarketModule
     */
    function getPerAccountCaps()
        external
        view
        override
        returns (uint128 maxPositionsPerAccount, uint128 maxCollateralsPerAccount)
    {
        GlobalPerpsMarketConfiguration.Data storage store = GlobalPerpsMarketConfiguration.load();
        maxPositionsPerAccount = store.maxPositionsPerAccount;
        maxCollateralsPerAccount = store.maxCollateralsPerAccount;
    }
}
