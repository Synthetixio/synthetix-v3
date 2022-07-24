//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralStorage.sol";

import "../interfaces/external/IAggregatorV3Interface.sol";
import "../interfaces/external/IRewardsDistributor.sol";

contract CollateralMixin is CollateralStorage {
    using SetUtil for SetUtil.AddressSet;

    error InvalidCollateralType(address collateralType);
    error InsufficientAvailableCollateral(uint accountId, address collateralType, uint requestedAmount);

    modifier collateralEnabled(address collateralType) {
        if (!_collateralStore().collateralsData[collateralType].enabled) {
            revert InvalidCollateralType(collateralType);
        }

        _;
    }

    function _getCollateralValue(address collateralType) internal view returns (uint) {
        (, int256 answer, , , ) = IAggregatorV3Interface(_collateralStore().collateralsData[collateralType].priceFeed)
            .latestRoundData();

        return uint(answer);
    }

    function _getAccountCollateralTotals(uint accountId, address collateralType)
        internal
        view
        returns (
            uint256 totalStaked,
            uint256 totalAssigned,
            uint256 totalLocked,
            uint256 totalEscrowed
        )
    {
        StakedCollateralData storage stakedCollateral = _collateralStore().stakedCollateralsDataByAccountId[accountId][
            collateralType
        ];
        totalStaked = stakedCollateral.amount;
        totalAssigned = stakedCollateral.assignedAmount;
        totalLocked = _getTotalLocked(stakedCollateral.locks);
        totalEscrowed = _getLockedEscrow(stakedCollateral.escrow);

        return (totalStaked, totalAssigned, totalLocked, totalEscrowed);
    }

    function _getAccountUnassignedCollateral(uint accountId, address collateralType) internal view returns (uint) {
        (uint256 total, uint256 assigned, , ) = _getAccountCollateralTotals(accountId, collateralType);

        return total - assigned;
    }

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

    function _getLockedEscrow(CurvesLibrary.PolynomialCurve storage escrow) internal view returns (uint) {
        return CurvesLibrary.calculateValueAtCurvePoint(escrow, block.timestamp);
    }

    function _getCollateralMinimumCRatio(address collateralType) internal view returns (uint) {
        return _collateralStore().collateralsData[collateralType].minimumCRatio;
    }
}
