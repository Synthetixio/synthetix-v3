//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../interfaces/ICollateralModule.sol";
import "../storage/CollateralStorage.sol";
import "../mixins/AccountRBACMixin.sol";
import "../mixins/CollateralMixin.sol";

contract CollateralModule is ICollateralModule, CollateralStorage, OwnableMixin, AccountRBACMixin, CollateralMixin {
    using SetUtil for SetUtil.AddressSet;

    error OutOfBounds();

    event CollateralAdded(address collateralType, address priceFeed, uint targetCRatio, uint minimumCRatio);
    event CollateralAdjusted(address collateralType, address priceFeed, uint targetCRatio, uint minimumCRatio, bool enabled);

    event CollateralStaked(uint accountId, address collateralType, uint amount, address executedBy);
    event CollateralUnstaked(uint accountId, address collateralType, uint amount, address executedBy);

    function adjustCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool enabled
    ) external override onlyOwner {
        if (!_collateralStore().collaterals.contains(collateralType)) {
            // Add a collateral entry
            _collateralStore().collaterals.add(collateralType);
        }
        _collateralStore().collateralsData[collateralType].targetCRatio = targetCRatio;
        _collateralStore().collateralsData[collateralType].minimumCRatio = minimumCRatio;
        _collateralStore().collateralsData[collateralType].priceFeed = priceFeed;
        _collateralStore().collateralsData[collateralType].enabled = enabled;

        emit CollateralAdjusted(collateralType, priceFeed, targetCRatio, minimumCRatio, enabled);
    }

    function getCollateralTypes(bool hideDisabled) external view override returns (address[] memory) {
        address[] memory collaterals = new address[](_collateralStore().collaterals.length());
        if (!hideDisabled) {
            collaterals = _collateralStore().collaterals.values();
        } else {
            uint collateralsIdx;
            for (uint i = 0; i < _collateralStore().collaterals.length(); i++) {
                address collateralType = _collateralStore().collaterals.valueAt(i + 1);
                if (_collateralStore().collateralsData[collateralType].enabled) {
                    collaterals[collateralsIdx++] = collateralType;
                }
            }
        }

        return collaterals;
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
        return (collateral.priceFeed, collateral.targetCRatio, collateral.minimumCRatio, collateral.enabled);
    }

    /////////////////////////////////////////////////
    // STAKE  /  UNSTAKE
    /////////////////////////////////////////////////

    function stake(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyRoleAuthorized(accountId, "stake") collateralEnabled(collateralType) {
        StakedCollateralData storage collateralData = _collateralStore().stakedCollateralsDataByAccountId[accountId][
            collateralType
        ];

        // TODO Use SafeTransferFrom
        IERC20(collateralType).transferFrom(_accountOwner(accountId), address(this), amount);

        if (!collateralData.isSet) {
            // new collateral
            collateralData.isSet = true;
            collateralData.amount = amount;
        } else {
            collateralData.amount += amount;
        }

        emit CollateralStaked(accountId, collateralType, amount, msg.sender);
    }

    function unstake(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyRoleAuthorized(accountId, "unstake") {
        uint256 availableCollateral = getAccountUnstakebleCollateral(accountId, collateralType);

        if (availableCollateral < amount) {
            revert InsufficientAvailableCollateral(accountId, collateralType, amount);
        }

        StakedCollateralData storage collateralData = _collateralStore().stakedCollateralsDataByAccountId[accountId][
            collateralType
        ];

        collateralData.amount -= amount;

        emit CollateralUnstaked(accountId, collateralType, amount, msg.sender);

        // TODO Use SafeTransfer
        IERC20(collateralType).transfer(_accountOwner(accountId), amount);
    }

    function getAccountCollaterals(uint accountId) external view override returns (address[] memory collateralTypes) {
        return _collateralStore().stakedCollateralsByAccountId[accountId].values();
    }

    function getAccountCollateralTotals(uint accountId, address collateralType)
        external
        view
        override
        returns (
            uint256 totalStaked,
            uint256 totalAssigned,
            uint256 totalLocked
        )
    {
        return _getAccountCollateralTotals(accountId, collateralType);
    }

    function getAccountUnassignedCollateral(uint accountId, address collateralType) public view override returns (uint) {
        return _getAccountUnassignedCollateral(accountId, collateralType);
    }

    function getAccountUnstakebleCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, uint256 assigned, uint256 locked) = _getAccountCollateralTotals(accountId, collateralType);

        if (locked > assigned) {
            return total - locked;
        }

        return total - assigned;
    }

    function cleanExpiredLocks(
        uint accountId,
        address collateralType,
        uint offset,
        uint items
    ) external override {
        _cleanExpiredLockes(
            _collateralStore().stakedCollateralsDataByAccountId[accountId][collateralType].locks,
            offset,
            items
        );
    }

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    function _cleanExpiredLockes(
        StakedCollateralLock[] storage locks,
        uint offset,
        uint items
    ) internal {
        if (offset > locks.length || items > locks.length) {
            revert OutOfBounds();
        }

        uint64 currentTime = uint64(block.timestamp);

        if (offset == 0 && items == 0) {
            // not specified, use all array
            items = locks.length;
        }

        uint index = offset;
        while (index < locks.length) {
            if (locks[index].lockExpirationTime <= currentTime) {
                // remove item
                locks[index] = locks[locks.length - 1];
                locks.pop();
            } else {
                index++;
            }
        }
    }
}
