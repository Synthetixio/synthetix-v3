//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../interfaces/ICollateralModule.sol";
import "../storage/CollateralStorage.sol";
import "../mixins/AccountRBACMixin.sol";

contract CollateralModule is ICollateralModule, CollateralStorage, OwnableMixin, AccountRBACMixin {
    using SetUtil for SetUtil.AddressSet;

    error CollateralAlreadyExists(address collateralType);
    error InvalidCollateralType(address collateralType);
    error InsufficientAvailableCollateral(uint accountId, address collateralType, uint requestedAmount);
    error OutOfBounds();

    event CollateralAdded(address collateralType, address priceFeed, uint targetCRatio, uint minimumCRatio);
    event CollateralAdjusted(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool disabled
    );

    event CollateralStaked(uint accountId, address collateralType, uint amount, address executedBy);
    event CollateralUnstaked(uint accountId, address collateralType, uint amount, address executedBy);

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

    /////////////////////////////////////////////////
    // STAKE  /  UNSTAKE
    /////////////////////////////////////////////////

    function stake(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyRoleAuthorized(accountId, "stake") {
        if (
            !_collateralStore().collaterals.contains(collateralType) ||
            _collateralStore().collateralsData[collateralType].disabled
        ) {
            revert InvalidCollateralType(collateralType);
        }

        // TODO check if (this) is approved to collateral.transferFrom() the amount

        // TODO check the rest of the info of the callateral to stake

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
        uint256 availableCollateral = getAccountFreeCollateral(accountId, collateralType);

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

    function getAccountCollateralTotals(uint accountId, address collateralType)
        public
        view
        override
        returns (
            uint,
            uint,
            uint
        )
    {
        StakedCollateralData storage stakedCollateral = _collateralStore().stakedCollateralsDataByAccountId[accountId][
            collateralType
        ];
        uint256 total = stakedCollateral.amount;
        uint256 assigned = stakedCollateral.assignedAmount;
        uint256 locked = _getTotalLocked(stakedCollateral.locks);

        return (total, locked, assigned);
    }

    function getAccountFreeCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, uint256 locked, uint256 assigned) = getAccountCollateralTotals(accountId, collateralType);

        if (locked > assigned) {
            return total - locked;
        }

        return total - assigned;
    }

    function getAccountUnassignedCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, , uint256 assigned) = getAccountCollateralTotals(accountId, collateralType);

        return total - assigned;
    }

    function cleanExpiredLockes(
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
    function _getTotalLocked(StakedCollateralLock[] storage locks) internal view returns (uint) {
        uint64 currentTime = uint64(block.timestamp);
        uint256 locked;

        for (uint i = 0; i < locks.length; i++) {
            if (locks[i].lockExpirationTime > currentTime) {
                locked += locks[i].amount;
            }
        }
        return locked;
    }

    // TODO this can be part of core-contract utils
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
