//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../../interfaces/ICollateralModule.sol";
import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/CollateralLock.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../utils/ERC20Helper.sol";

/**
 * @title See {ICollateralModule}
 *
 * TODO: Consider splitting this into CollateralConfigurationModule and CollateralModule.
 * The former is for owner only stuff, and the latter for users.
 */
contract CollateralModule is ICollateralModule {
    using SetUtil for SetUtil.AddressSet;
    using ERC20Helper for address;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Account for Account.Data;
    using AccountRBAC for AccountRBAC.Data;
    using Collateral for Collateral.Data;

    error InvalidCollateral(address collateralType);

    // 86400 * 365.26
    uint private constant _SECONDS_PER_YEAR = 31558464;

    error OutOfBounds();

    error InsufficientAccountCollateral(uint amount);

    /**
     * @dev See {ICollateralModule-configureCollateral}.
     */
    function configureCollateral(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        uint liquidationReward,
        bool depositingEnabled
    ) external override {
        OwnableStorage.onlyOwner();
        CollateralConfiguration.set(
            collateralType,
            priceFeed,
            targetCRatio,
            minimumCRatio,
            liquidationReward,
            depositingEnabled
        );
        emit CollateralConfigured(
            collateralType,
            priceFeed,
            targetCRatio,
            minimumCRatio,
            liquidationReward,
            depositingEnabled
        );
    }

    /**
     * @dev See {ICollateralModule-getCollateralConfigurations}.
     */
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

            if (!hideDisabled || collateral.depositingEnabled) {
                filteredCollaterals[collateralsIdx++] = collateral;
            }
        }

        return filteredCollaterals;
    }

    /**
     * @dev See {ICollateralModule-getCollateralConfiguration}.
     */
    function getCollateralConfiguration(address collateralType)
        external
        view
        override
        returns (CollateralConfiguration.Data memory)
    {
        return CollateralConfiguration.load(collateralType);
    }

    function getCollateralPrice(address collateralType) external view override returns (uint) {
        return CollateralConfiguration.getCollateralPrice(CollateralConfiguration.load(collateralType));
    }

    /////////////////////////////////////////////////
    // DEPOSIT  /  WITHDRAW
    /////////////////////////////////////////////////

    /**
     * @dev See {ICollateralModule-deposit}.
     */
    function deposit(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override {
        CollateralConfiguration.collateralEnabled(collateralType);
        Account.onlyWithPermission(accountId, AccountRBAC._DEPOSIT_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        // TODO: Deposit/withdraw should be transferring from/to msg.sender,
        // instead of the account's owner address.
        // If msg.sender has permission for a deposit/withdraw operation,
        // then it is most natural for the collateral to be pulled from msg.sender.
        address user = account.rbac.owner;

        address self = address(this);

        uint allowance = IERC20(collateralType).allowance(user, self);
        if (allowance < amount) {
            revert IERC20.InsufficientAllowance(amount, allowance);
        }

        collateralType.safeTransferFrom(user, self, amount);

        account.collaterals[collateralType].deposit(amount);

        emit Deposited(accountId, collateralType, amount, msg.sender);
    }

    /**
     * @dev See {ICollateralModule-Withdraw}.
     */
    function Withdraw(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override {
        Account.onlyWithPermission(accountId, AccountRBAC._WITHDRAW_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        if (account.collaterals[collateralType].availableAmount < amount) {
            revert InsufficientAccountCollateral(amount);
        }

        account.collaterals[collateralType].deductCollateral(amount);

        collateralType.safeTransfer(account.rbac.owner, amount);

        emit Withdrawn(accountId, collateralType, amount, msg.sender);
    }

    /**
     * @dev See {ICollateralModule-getAccountCollateral}.
     */
    function getAccountCollateral(uint128 accountId, address collateralType)
        external
        view
        override
        returns (
            uint256 totalDeposited,
            uint256 totalAssigned,
            uint256 totalLocked
        )
    {
        return Account.load(accountId).getCollateralTotals(collateralType);
    }

    /**
     * @dev See {ICollateralModule-getAccountAvailableCollateral}.
     */
    function getAccountAvailableCollateral(uint128 accountId, address collateralType) public view override returns (uint) {
        return Account.load(accountId).collaterals[collateralType].availableAmount;
    }

    /**
     * @dev See {ICollateralModule-cleanExpiredLocks}.
     */
    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint offset,
        uint items
    ) external override {
        CollateralLock.Data[] storage locks = Account.load(accountId).collaterals[collateralType].locks;

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

    /**
     * @dev See {ICollateralModule-createLock}.
     */
    function createLock(
        uint128 accountId,
        address collateralType,
        uint amount,
        uint64 expireTimestamp
    ) external override {
        Account.onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION);

        Account.Data storage account = Account.load(accountId);

        (uint totalStaked, , uint totalLocked) = account.getCollateralTotals(collateralType);

        if (totalStaked - totalLocked < amount) {
            revert InsufficientAccountCollateral(amount);
        }

        account.collaterals[collateralType].locks.push(CollateralLock.Data(amount, expireTimestamp));
    }

    /*function getAccountUnstakebleCollateral(uint accountId, address collateralType) public view override returns (uint) {
        (uint256 total, uint256 assigned, uint256 locked, ) = _getAccountCollateralTotals(accountId, collateralType);

        if (locked > assigned) {
            return total - locked;
        }

        return total - assigned;
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


    /////////////////////////////////////////////////
    // INTERNALS
    /////////////////////////////////////////////////

    /*
    function _calculateRewardTokenMinted(uint amount, uint duration) internal pure returns (uint) {
        return (amount * duration) / _SECONDS_PER_YEAR;
    }*/
}
