//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralStorage.sol";

import "../interfaces/IPriceFeed.sol";

contract CollateralMixin is CollateralStorage {
    using SetUtil for SetUtil.AddressSet;

    error InvalidCollateralType(address collateralType);

    function _getCollateralValue(address collateralType) internal view returns (uint) {
        if (
            !_collateralStore().collaterals.contains(collateralType) ||
            _collateralStore().collateralsData[collateralType].disabled
        ) {
            revert InvalidCollateralType(collateralType);
        }

        return IPriceFeed(_collateralStore().collateralsData[collateralType].priceFeed).getCurrentPrice();
    }
}
