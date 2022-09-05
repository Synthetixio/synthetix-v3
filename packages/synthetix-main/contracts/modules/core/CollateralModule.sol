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

    function configureCollateral(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        uint liquidationReward,
        bool enabled
    ) external override onlyOwner {
        CollateralStore storage store = _collateralStore();
        SetUtil.AddressSet storage collaterals = store.collaterals;

        if (!collaterals.contains(collateralType)) {
            collaterals.add(collateralType);
        }

        CollateralConfiguration storage collateral = store.collateralConfigurations[collateralType];

        collateral.tokenAddress = collateralType;
        collateral.targetCRatio = targetCRatio;
        collateral.minimumCRatio = minimumCRatio;
        collateral.priceFeed = priceFeed;
        collateral.liquidationReward = liquidationReward;
        collateral.enabled = enabled;

        emit CollateralConfigured(collateralType, priceFeed, targetCRatio, minimumCRatio, liquidationReward, enabled);
    }

    function getCollateralConfigurations(bool hideDisabled)
        external
        view
        override
        returns (CollateralStorage.CollateralConfiguration[] memory)
    {
        CollateralStore storage store = _collateralStore();
        SetUtil.AddressSet storage collaterals = store.collaterals;

        uint numCollaterals = collaterals.length();
        CollateralConfiguration[] memory filteredCollaterals = new CollateralConfiguration[](numCollaterals);

        uint collateralsIdx;
        for (uint i = 1; i <= numCollaterals; i++) {
            address collateralType = collaterals.valueAt(i);

            CollateralConfiguration storage collateral = store.collateralConfigurations[collateralType];

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
        returns (CollateralStorage.CollateralConfiguration memory)
    {
        return _collateralStore().collateralConfigurations[collateralType];
    }

    /////////////////////////////////////////////////
    // DEPOSIT  /  WITHDRAW
    /////////////////////////////////////////////////

    function depositCollateral(
        uint accountId,
        address collateralType,
        uint amount
    ) public override onlyWithPermission(accountId, _DEPOSIT_PERMISSION) collateralEnabled(collateralType) {
        collateralType.safeTransferFrom(_accountOwner(accountId), address(this), amount);

        _depositCollateral(accountId, collateralType, amount);

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

        collateralData.availableAmount -= amount;

        collateralType.safeTransfer(_accountOwner(accountId), amount);

        emit CollateralWithdrawn(accountId, collateralType, amount, msg.sender);
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

        if (!_collateralStore().collateralConfigurations[address(rewardedToken)].enabled) {
            revert InvalidCollateral(address(rewardedToken));
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
}
