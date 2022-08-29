//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../../interfaces/ICollateralModule.sol";
import "../../storage/CollateralStorage.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/CollateralMixin.sol";

import "../../utils/ERC20Helper.sol";

contract CollateralModule is
    ICollateralModule,
    CollateralStorage,
    OwnableMixin,
    AccountRBACMixin,
    CollateralMixin,
    AssociatedSystemsMixin
{
    using SetUtil for SetUtil.AddressSet;
    using ERC20Helper for address;

    //bytes32 private constant _REDEEMABLE_REWARDS_TOKEN = "eSNXToken";
    //bytes32 private constant _REWARDED_TOKEN = "SNXToken";

    // 86400 * 365.26
    uint private constant _SECONDS_PER_YEAR = 31558464;

    error OutOfBounds();

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
        _collateralStore().collateralsData[collateralType].tokenAddress = collateralType;
        _collateralStore().collateralsData[collateralType].targetCRatio = targetCRatio;
        _collateralStore().collateralsData[collateralType].minimumCRatio = minimumCRatio;
        _collateralStore().collateralsData[collateralType].priceFeed = priceFeed;
        _collateralStore().collateralsData[collateralType].enabled = enabled;

        emit CollateralConfigured(collateralType, priceFeed, targetCRatio, minimumCRatio, enabled);
    }

    function getCollateralTypes(bool hideDisabled)
        external
        view
        override
        returns (CollateralStorage.CollateralData[] memory)
    {
        CollateralData[] memory collaterals = new CollateralData[](_collateralStore().collaterals.length());

        uint collateralsIdx;
        for (uint i = 0; i < _collateralStore().collaterals.length(); i++) {
            address collateralType = _collateralStore().collaterals.valueAt(i + 1);
            if (!hideDisabled || _collateralStore().collateralsData[collateralType].enabled) {
                collaterals[collateralsIdx++] = _collateralStore().collateralsData[collateralType];
            }
        }

        return collaterals;
    }

    function getCollateralType(address collateralType)
        external
        view
        override
        returns (CollateralStorage.CollateralData memory)
    {
        CollateralData storage collateral = _collateralStore().collateralsData[collateralType];
        return collateral;
    }

    /////////////////////////////////////////////////
    // DEPOSIT  /  WITHDRAW
    /////////////////////////////////////////////////

    function depositCollateral(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, _DEPOSIT_PERMISSION) collateralEnabled(collateralType) {
        DepositedCollateralData storage collateralData = _collateralStore().depositedCollateralDataByAccountId[accountId][
            collateralType
        ];

        collateralType.safeTransferFrom(_accountOwner(accountId), address(this), amount);

        if (!collateralData.isSet) {
            // new collateral
            collateralData.isSet = true;
            collateralData.amount = amount;
        } else {
            collateralData.amount += amount;
        }

        emit CollateralDeposited(accountId, collateralType, amount, msg.sender);
    }

    function withdrawCollateral(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, _WITHDRAW_PERMISSION) {
        uint256 availableCollateral = getAccountAvailableCollateral(accountId, collateralType);

        if (availableCollateral < amount) {
            revert InsufficientAccountCollateral(accountId, collateralType, amount);
        }

        DepositedCollateralData storage collateralData = _collateralStore().depositedCollateralDataByAccountId[accountId][
            collateralType
        ];

        collateralData.amount -= amount;

        emit CollateralWithdrawn(accountId, collateralType, amount, msg.sender);

        collateralType.safeTransfer(_accountOwner(accountId), amount);
    }

    function getAccountCollateral(uint accountId, address collateralType)
        external
        view
        override
        returns (uint256 totalStaked, uint256 totalAssigned)
    //uint256 totalLocked,
    //uint256 totalEscrowed
    {
        return _getAccountCollateralTotals(accountId, collateralType);
    }

    function getAccountAvailableCollateral(uint accountId, address collateralType) public view override returns (uint) {
        return _getAccountUnassignedCollateral(accountId, collateralType);
    }

    /*
    function getAccountUnstakebleCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, uint256 assigned, uint256 locked, ) = _getAccountCollateralTotals(accountId, collateralType);

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
        _cleanExpiredLocks(
            _collateralStore().stakedCollateralsDataByAccountId[accountId][collateralType].locks,
            offset,
            items
        );
    }

    function redeemReward(
        uint accountId,
        uint amount,
        uint duration
    ) external override {
        ITokenModule redeemableRewardsToken = _getToken(_REDEEMABLE_REWARDS_TOKEN);
        ITokenModule rewardedToken = _getToken(_REWARDED_TOKEN);

        if (!_collateralStore().collateralsData[address(rewardedToken)].enabled) {
            revert InvalidCollateralType(address(rewardedToken));
        }

        DepositedCollateralData storage collateralData = _collateralStore().stakedCollateralsDataByAccountId[accountId][
            address(rewardedToken)
        ];
        uint rewardTokenMinted = _calculateRewardTokenMinted(amount, duration);

        redeemableRewardsToken.burn(msg.sender, amount);
        rewardedToken.mint(address(this), amount);

        // adjust the user reward curve
        CurvesLibrary.PolynomialCurve memory oldCurve = collateralData.escrow;

        CurvesLibrary.PolynomialCurve memory newCurve = CurvesLibrary.generateCurve(
            CurvesLibrary.Point(block.timestamp, rewardTokenMinted),
            CurvesLibrary.Point(block.timestamp / 2, rewardTokenMinted / 2),
            CurvesLibrary.Point(block.timestamp + duration, 0)
        );

        collateralData.escrow = CurvesLibrary.combineCurves(oldCurve, newCurve);

        if (!collateralData.isSet) {
            // new collateral
            collateralData.isSet = true;
            collateralData.amount = amount;
        } else {
            collateralData.amount += amount;
        }
    }
*/

    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    /*
    function _calculateRewardTokenMinted(uint amount, uint duration) internal pure returns (uint) {
        return (amount * duration) / _SECONDS_PER_YEAR;
    }

    function _cleanExpiredLocks(
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
*/
}
