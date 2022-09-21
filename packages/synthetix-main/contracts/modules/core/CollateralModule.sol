//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../../interfaces/ICollateralModule.sol";
import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../utils/ERC20Helper.sol";

contract CollateralModule is
    ICollateralModule,
    OwnableMixin,
    AssociatedSystemsMixin
{
    using SetUtil for SetUtil.AddressSet;
    using ERC20Helper for address;

    using Account for Account.Data;
    using AccountRBAC for AccountRBAC.Data;
    using Collateral for Collateral.Data;

    error PermissionDenied(uint128 accountId, bytes32 permission, address target);

    error InvalidCollateral(address collateralType);

    //bytes32 private constant _REDEEMABLE_REWARDS_TOKEN = "eSNXToken";
    //bytes32 private constant _REWARDED_TOKEN = "SNXToken";

    // 86400 * 365.26
    uint private constant _SECONDS_PER_YEAR = 31558464;

    error OutOfBounds();

    function configureCollateral(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        uint liquidationReward,
        bool enabled
    ) external override onlyOwner {
        CollateralConfiguration.set(collateralType, priceFeed, targetCRatio, minimumCRatio, liquidationReward, enabled);
        emit CollateralConfigured(collateralType, priceFeed, targetCRatio, minimumCRatio, liquidationReward, enabled);
    }

    function getCollateralConfigurations(bool hideDisabled)
        external
        view
        override
        returns (CollateralConfiguration.Data[] memory)
    {
        SetUtil.AddressSet storage collateralTypes = CollateralConfiguration.loadAvailableCollaterals();

        uint numCollaterals = collateralTypes.length();
        CollateralConfiguration.Data[] memory filteredCollaterals = new CollateralConfiguration.Data[](numCollaterals);

        uint collateralsIdx;
        for (uint i = 1; i <= numCollaterals; i++) {
            address collateralType = collateralTypes.valueAt(i);

            CollateralConfiguration.Data storage collateral = CollateralConfiguration.load(collateralType);

            if (!hideDisabled || collateral.enabled) {
                filteredCollaterals[collateralsIdx++] = collateral;
            }
        }

        return filteredCollaterals;
    }

    function getCollateralConfiguration(address collateralType)
        external
        view
        override
        returns (CollateralConfiguration.Data memory)
    {
        return CollateralConfiguration.load(collateralType);
    }

    /////////////////////////////////////////////////
    // DEPOSIT  /  WITHDRAW
    /////////////////////////////////////////////////

    function depositCollateral(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, AccountRBAC._DEPOSIT_PERMISSION) collateralEnabled(collateralType) {
        collateralType.safeTransferFrom(msg.sender, address(this), amount);

        Account.load(accountId).collaterals[collateralType].depositCollateral(amount);

        emit CollateralDeposited(accountId, collateralType, amount, msg.sender);
    }

    function withdrawCollateral(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, AccountRBAC._WITHDRAW_PERMISSION) {
        uint256 availableCollateral = getAccountAvailableCollateral(accountId, collateralType);
        
        Account.load(accountId).collaterals[collateralType].deductCollateral(amount);

        collateralType.safeTransfer(msg.sender, amount);

        emit CollateralWithdrawn(accountId, collateralType, amount, msg.sender);
    }

    function getAccountCollateral(uint128 accountId, address collateralType)
        external
        view
        override
        returns (uint256 totalStaked, uint256 totalAssigned)
    //uint256 totalLocked,
    //uint256 totalEscrowed
    {
        return Account.load(accountId).getCollateralTotals(collateralType);
    }

    function getAccountAvailableCollateral(uint128 accountId, address collateralType) public view override returns (uint) {
        return Account.load(accountId).collaterals[collateralType].availableAmount;
    }

    /*
    function getAccountUnstakebleCollateral(uint128 accountId, address collateralType) public view override returns (uint) {
        (uint256 total, uint256 assigned, uint256 locked, ) = _getAccountCollateralTotals(accountId, collateralType);

        if (locked > assigned) {
            return total - locked;
        }

        return total - assigned;
    }

    function cleanExpiredLocks(
        uint128 accountId,
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
        uint128 accountId,
        uint amount,
        uint duration
    ) external override {
        ITokenModule redeemableRewardsToken = _getToken(_REDEEMABLE_REWARDS_TOKEN);
        ITokenModule rewardedToken = _getToken(_REWARDED_TOKEN);

        if (!_collateralStore().collateralConfigurations[address(rewardedToken)].enabled) {
            revert InvalidCollateral(address(rewardedToken));
        }

        CollateralData storage collateralData = _collateralStore().stakedCollateralsDataByAccountId[accountId][
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
            collateralData.availableAmount = amount;
        } else {
            collateralData.availableAmount += amount;
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

    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }

    modifier collateralEnabled(address collateralType) {
        if (!CollateralConfiguration.load(collateralType).enabled) {
            revert InvalidCollateral(collateralType);
        }

        _;
    }
}
