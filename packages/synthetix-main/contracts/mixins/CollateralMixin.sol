//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralStorage.sol";
import "../storage/VaultStorage.sol";

import "../interfaces/external/IAggregatorV3Interface.sol";

import "../utils/SharesLibrary.sol";

contract CollateralMixin is CollateralStorage, VaultStorage {
    using SetUtil for SetUtil.AddressSet;
    using SetUtil for SetUtil.UintSet;
    using SharesLibrary for SharesLibrary.Distribution;

    error InvalidCollateral(address collateralType);
    error InsufficientAccountCollateral(uint accountId, address collateralType, uint requestedAmount);

    modifier collateralEnabled(address collateralType) {
        if (!_collateralStore().collateralConfigurations[collateralType].stakingEnabled) {
            revert InvalidCollateral(collateralType);
        }

        _;
    }

    function _getCollateralPrice(address collateralType) internal view returns (uint) {
        (, int256 answer, , , ) = IAggregatorV3Interface(
            _collateralStore().collateralConfigurations[collateralType].priceFeed
        ).latestRoundData();

        // sanity check
        // TODO: this will be removed when we get the oracle manager
        require(answer > 0, "The collateral value is 0");

        return uint(answer);
    }

    function _getAccountCollateralTotals(uint accountId, address collateralType)
        internal
        view
        returns (uint256 totalDeposited, uint256 totalAssigned)
    {
        CollateralData storage stakedCollateral = _collateralStore().collateralDataByAccountId[accountId][collateralType];

        totalAssigned = _getAccountAssignedCollateral(accountId, collateralType);
        totalDeposited = totalAssigned + stakedCollateral.availableAmount;
        //totalLocked = _getTotalLocked(stakedCollateral.locks);
        //totalEscrowed = _getLockedEscrow(stakedCollateral.escrow);

        return (totalDeposited, totalAssigned); //, totalLocked, totalEscrowed);
    }

    function _getAccountUnassignedCollateral(uint accountId, address collateralType) internal view returns (uint) {
        CollateralData storage stakedCollateral = _collateralStore().collateralDataByAccountId[accountId][collateralType];

        return stakedCollateral.availableAmount;
    }

    function _getAccountAssignedCollateral(uint accountId, address collateralType) internal view returns (uint) {
        CollateralData storage stakedCollateral = _collateralStore().collateralDataByAccountId[accountId][collateralType];

        uint totalAssigned = 0;
        for (uint i = 1; i <= stakedCollateral.pools.length(); i++) {
            uint poolIdx = stakedCollateral.pools.valueAt(i);

            VaultStorage.VaultData storage vaultData = _vaultStore().vaults[poolIdx][collateralType];

            totalAssigned += uint(vaultData.epochData[vaultData.epoch].collateralDist.getActorValue(bytes32(accountId)));
        }

        return totalAssigned;
    }

    function _getTotalLocked(CollateralLock[] storage locks) internal view returns (uint) {
        uint64 currentTime = uint64(block.timestamp);

        uint256 locked;
        for (uint i = 0; i < locks.length; i++) {
            CollateralLock storage lock = locks[i];

            if (lock.lockExpirationTime > currentTime) {
                locked += lock.amount;
            }
        }

        return locked;
    }

    function _getLockedEscrow(CurvesLibrary.PolynomialCurve storage escrow) internal view returns (uint) {
        return CurvesLibrary.calculateValueAtCurvePoint(escrow, block.timestamp);
    }

    function _collateralTargetCRatio(address collateralType) internal view returns (uint) {
        return _collateralStore().collateralConfigurations[collateralType].targetCRatio;
    }

    function _collateralMinimumCRatio(address collateralType) internal view returns (uint) {
        return _collateralStore().collateralConfigurations[collateralType].minimumCRatio;
    }

    function _collateralLiquidationReward(address collateralType) internal view returns (uint) {
        return _collateralStore().collateralConfigurations[collateralType].liquidationReward;
    }

    function _depositCollateral(
        uint accountId,
        address collateralType,
        uint amount
    ) internal {
        CollateralData storage collateralData = _collateralStore().collateralDataByAccountId[accountId][collateralType];

        if (!collateralData.isSet) {
            // new collateral
            collateralData.isSet = true;
            collateralData.availableAmount = amount;
        } else {
            collateralData.availableAmount += amount;
        }
    }

    function _setDelegatePoolId(
        uint accountId,
        uint poolId,
        address collateralType
    ) internal {
        CollateralData storage stakedCollateral = _collateralStore().collateralDataByAccountId[accountId][collateralType];
        if (!stakedCollateral.pools.contains(poolId)) {
            stakedCollateral.pools.add(poolId);
        }
    }
}
