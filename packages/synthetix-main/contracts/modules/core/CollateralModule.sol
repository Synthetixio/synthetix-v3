//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";

import "../../interfaces/ICollateralModule.sol";
import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/CollateralLock.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

// TODO: Move to core-contracts
import "../../utils/ERC20Helper.sol";

contract CollateralModule is ICollateralModule, OwnableMixin, AssociatedSystemsMixin {
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

    error InsufficientAccountCollateral(uint amount);

    function configureCollateral(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        uint liquidationReward,
        bool stakingEnabled
    ) external override onlyOwner {
        CollateralConfiguration.set(
            collateralType,
            priceFeed,
            targetCRatio,
            minimumCRatio,
            liquidationReward,
            stakingEnabled
        );
        emit CollateralConfigured(collateralType, priceFeed, targetCRatio, minimumCRatio, liquidationReward, stakingEnabled);
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

            if (!hideDisabled || collateral.stakingEnabled) {
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

    function getCollateralPrice(address collateralType) external view override returns (uint) {
        return CollateralConfiguration.getCollateralPrice(CollateralConfiguration.load(collateralType));
    }

    /////////////////////////////////////////////////
    // DEPOSIT  /  WITHDRAW
    /////////////////////////////////////////////////

    /**
     * @dev See {ICollateralModule-depositCollateral}.
     */
    function depositCollateral(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, AccountRBAC._DEPOSIT_PERMISSION) collateralEnabled(collateralType) {
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

        account.collaterals[collateralType].depositCollateral(amount);

        emit CollateralDeposited(accountId, collateralType, amount, msg.sender);
    }

    function withdrawCollateral(
        uint128 accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, AccountRBAC._WITHDRAW_PERMISSION) {
        if (Account.load(accountId).collaterals[collateralType].availableAmount < amount) {
            revert InsufficientAccountCollateral(amount);
        }

        Account.load(accountId).collaterals[collateralType].deductCollateral(amount);

        collateralType.safeTransfer(Account.load(accountId).rbac.owner, amount);

        emit CollateralWithdrawn(accountId, collateralType, amount, msg.sender);
    }

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

    function getAccountAvailableCollateral(uint128 accountId, address collateralType) public view override returns (uint) {
        return Account.load(accountId).collaterals[collateralType].availableAmount;
    }

    function cleanExpiredLocks(
        uint128 accountId,
        address collateralType,
        uint offset,
        uint items
    ) external override {
        _cleanExpiredLocks(Account.load(accountId).collaterals[collateralType].locks, offset, items);
    }

    function createLock(
        uint128 accountId,
        address collateralType,
        uint amount,
        uint64 expireTimestamp
    ) external override onlyWithPermission(accountId, AccountRBAC._ADMIN_PERMISSION) {
        (uint totalStaked, , uint totalLocked) = Account.load(accountId).getCollateralTotals(collateralType);

        if (totalStaked - totalLocked < amount) {
            revert InsufficientAccountCollateral(amount);
        }

        Account.load(accountId).collaterals[collateralType].locks.push(CollateralLock.Data(amount, expireTimestamp));
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

    function _cleanExpiredLocks(
        CollateralLock.Data[] storage locks,
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

    modifier onlyWithPermission(uint128 accountId, bytes32 permission) {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert PermissionDenied(accountId, permission, msg.sender);
        }

        _;
    }

    modifier collateralEnabled(address collateralType) {
        if (!CollateralConfiguration.load(collateralType).stakingEnabled) {
            revert InvalidCollateral(collateralType);
        }

        _;
    }
}
