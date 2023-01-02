//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC165Helper.sol";

import "../interfaces/IFeeConfigurationModule.sol";
import "../interfaces/ISynthTokenModule.sol";
import "../interfaces/external/IFeeCollector.sol";
import "../storage/SpotMarketFactory.sol";

contract FeeConfigurationModule is IFeeConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    function setAtomicFixedFee(uint128 synthMarketId, uint atomicFixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.atomicFixedFee = atomicFixedFee;

        emit AtomicFixedFeeSet(synthMarketId, atomicFixedFee);
    }

    function setMarketSkewScale(uint128 synthMarketId, uint skewScale) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.skewScale = skewScale;

        emit MarketSkewScaleSet(synthMarketId, skewScale);
    }

    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint utilizationFeeRate
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.utilizationFeeRate = utilizationFeeRate;

        emit MarketUtilizationFeesSet(synthMarketId, utilizationFeeRate);
    }

    function setCustomTransactorFees(
        uint128 synthMarketId,
        address transactor,
        uint fixedFeeAmount
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);
        Fee.setAtomicFixedFeeOverride(synthMarketId, transactor, fixedFeeAmount);

        emit AtomicTransactorFixedFeeSet(synthMarketId, transactor, fixedFeeAmount);
    }

    function setFeeCollector(uint128 synthMarketId, address feeCollector) external override {
        if (feeCollector != address(0)) {
            if (
                !ERC165Helper.safeSupportsInterface(feeCollector, type(IFeeCollector).interfaceId)
            ) {
                revert InvalidFeeCollectorInterface(feeCollector);
            }
        }

        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.feeCollector = IFeeCollector(feeCollector);

        emit FeeCollectorSet(synthMarketId, feeCollector);
    }
}
