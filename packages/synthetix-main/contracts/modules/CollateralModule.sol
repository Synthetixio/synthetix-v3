//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "../interfaces/ICollateralModule.sol";
import "../storage/CollateralStorage.sol";

contract CollateralModule is ICollateralModule, OwnableMixin, CollateralStorage {
    using SetUtil for SetUtil.AddressSet;

    error CollateralAlreadyExists(address collateralType);
    error InvalidCollateralType(address collateralType);

    event CollateralAdded(address collateralType, address priceFeed, uint targetCRatio, uint minimumCRatio);
    event CollateralAdjusted(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool disabled
    );

    function addCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio
    ) external override onlyOwner {
        if (_collateralStore().collaterals.contains(collateralType)) {
            revert CollateralAlreadyExists(collateralType);
        }

        _collateralStore().collaterals.add(collateralType);

        _collateralStore().collateralsData[collateralType].targetCRatio = targetCRatio;
        _collateralStore().collateralsData[collateralType].minimumCRatio = minimumCRatio;
        _collateralStore().collateralsData[collateralType].priceFeed = priceFeed;
        _collateralStore().collateralsData[collateralType].disabled = false;

        emit CollateralAdded(collateralType, priceFeed, targetCRatio, minimumCRatio);
    }

    function adjustCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool disabled
    ) external override onlyOwner {
        if (!_collateralStore().collaterals.contains(collateralType)) {
            revert InvalidCollateralType(collateralType);
        }

        _collateralStore().collateralsData[collateralType].targetCRatio = targetCRatio;
        _collateralStore().collateralsData[collateralType].minimumCRatio = minimumCRatio;
        _collateralStore().collateralsData[collateralType].priceFeed = priceFeed;
        _collateralStore().collateralsData[collateralType].disabled = disabled;

        emit CollateralAdjusted(collateralType, priceFeed, targetCRatio, minimumCRatio, disabled);
    }

    function getCollateralTypes() external view override returns (address[] memory) {
        return _collateralStore().collaterals.values();
    }

    function getCollateralType(address collateralType)
        external
        view
        override
        returns (
            address,
            uint,
            uint,
            bool
        )
    {
        CollateralData storage collateral = _collateralStore().collateralsData[collateralType];
        return (collateral.priceFeed, collateral.targetCRatio, collateral.minimumCRatio, collateral.disabled);
    }
}
