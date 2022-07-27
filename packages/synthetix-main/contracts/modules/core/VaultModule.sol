//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/FundMixin.sol";

import "../../utils/SharesLibrary.sol";

import "../../storage/FundVaultStorage.sol";
import "../../interfaces/IVaultModule.sol";
import "../../interfaces/IUSDToken.sol";

import "../../submodules/FundEventAndErrors.sol";

contract VaultModule is
    IVaultModule,
    FundVaultStorage,
    FundEventAndErrors,
    AccountRBACMixin,
    OwnableMixin,
    AssociatedSystemsMixin,
    FundMixin
{
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using MathUtil for uint256;

    uint public constant MAX_REWARD_DISTRIBUTIONS = 10;
    bytes32 constant private _USD_TOKEN = "USDToken";

    error InvalidLeverage(uint leverage);

    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) fundExists(fundId) {
        // Fix leverage to 1 until it's enabled
        if (leverage != 1) revert InvalidLeverage(leverage);

        bytes32 lid = _getLiquidityItemId(accountId, fundId, collateralType);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        SetUtil.Bytes32Set storage liquidityItemIds = vaultData.liquidityItemIds;

        if (!liquidityItemIds.contains(lid)) {
            if (_getAccountUnassignedCollateral(accountId, collateralType) < amount) {
                revert InsufficientAvailableCollateral(accountId, collateralType, amount);
            }

            // lid not found in set =>  new position
            _addPosition(lid, accountId, fundId, collateralType, amount, leverage);
        } else {
            // Position found, need to adjust (increase, decrease or remove)
            LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[lid];

            if (
                liquidityItem.accountId != accountId ||
                liquidityItem.collateralType != collateralType ||
                liquidityItem.fundId != fundId ||
                liquidityItem.leverage != leverage
            ) {
                // Wrong parameters (in fact should be another lid) but prefer to be on the safe side. Check and revert
                revert InvalidParameters();
            }

            uint currentLiquidityAmount = liquidityItem.collateralAmount;

            if (amount == 0) {
                _removePosition(lid, liquidityItem);
            } else if (currentLiquidityAmount < amount) {
                if (_getAccountUnassignedCollateral(accountId, collateralType) < amount - currentLiquidityAmount) {
                    revert InsufficientAvailableCollateral(accountId, collateralType, amount);
                }

                _increasePosition(lid, liquidityItem, amount);
            } else if (currentLiquidityAmount > amount) {
                _decreasePosition(lid, liquidityItem, amount);
            } else {
                // no change
                revert InvalidParameters();
            }
        }

        _rebalanceFundPositions(fundId, false);

        emit DelegationUpdated(lid, accountId, fundId, collateralType, amount, leverage);
    }

    function _addPosition(
        bytes32 liquidityItemId,
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        uint collateralValue = amount * _getCollateralValue(collateralType);

        // Add liquidityItem into vault
        vaultData.liquidityItemIds.add(liquidityItemId);

        // Add liquidityItem into accounts
        _fundVaultStore().accountliquidityItems[accountId].add(liquidityItemId);

        // Add (if needed) collateral to fund
        if (!_fundVaultStore().fundCollateralTypes[fundId].contains(collateralType)) {
            _fundVaultStore().fundCollateralTypes[fundId].add(collateralType);
        }

        uint shares = _calculateShares(fundId, collateralType, collateralValue, leverage);
        uint initialDebt = _calculateInitialDebt(collateralValue, leverage); // how that works with amount adjustments?

        LiquidityItem memory liquidityItem;
        liquidityItem.collateralType = collateralType;
        liquidityItem.accountId = accountId;
        liquidityItem.fundId = fundId;
        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;
        liquidityItem.leverage = leverage;

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares += liquidityItem.shares;
        vaultData.totalCollateral += amount;

        emit PositionAdded(liquidityItemId, accountId, fundId, collateralType, amount, leverage, shares, initialDebt);
    }

    function _removePosition(bytes32 liquidityItemId, LiquidityItem storage liquidityItem) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];

        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        // uint oldnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        vaultData.liquidityItemIds.remove(liquidityItemId);
        _fundVaultStore().accountliquidityItems[liquidityItem.accountId].remove(liquidityItemId);

        liquidityItem.collateralAmount = 0;
        liquidityItem.shares = 0;
        liquidityItem.initialDebt = 0; // how that works with amount adjustments?

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares -= oldSharesAmount;
        vaultData.totalCollateral -= oldAmount;

        emit PositionRemoved(liquidityItemId, liquidityItem.accountId, liquidityItem.fundId, liquidityItem.collateralType);
    }

    function _increasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint amount
    ) internal {
        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;

        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];
        uint collateralValue = amount * _getCollateralValue(liquidityItem.collateralType);

        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _calculateShares(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        );
        uint initialDebt = _calculateInitialDebt(collateralValue, liquidityItem.leverage); // how that works with amount adjustments?

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares += liquidityItem.shares - oldSharesAmount;
        vaultData.totalCollateral += amount - oldAmount;

        emit PositionIncreased(
            liquidityItemId,
            liquidityItem.fundId,
            liquidityItem.collateralType,
            amount,
            liquidityItem.leverage,
            shares,
            initialDebt
        );
    }

    function _decreasePosition(
        bytes32 liquidityItemId,
        LiquidityItem storage liquidityItem,
        uint amount
    ) internal {
        VaultData storage vaultData = _fundVaultStore().fundVaults[liquidityItem.fundId][liquidityItem.collateralType];
        uint collateralValue = amount * _getCollateralValue(liquidityItem.collateralType);

        uint oldAmount = liquidityItem.collateralAmount;
        uint oldSharesAmount = liquidityItem.shares;
        // uint oldnitialDebt = liquidityItem.initialDebt;
        // TODO check if is enabled to remove position comparing old and new data

        uint shares = _calculateShares(
            liquidityItem.fundId,
            liquidityItem.collateralType,
            collateralValue,
            liquidityItem.leverage
        );
        uint initialDebt = _calculateInitialDebt(collateralValue, liquidityItem.leverage); // how that works with amount adjustments?

        liquidityItem.collateralAmount = amount;
        liquidityItem.shares = shares;
        liquidityItem.initialDebt = initialDebt;

        _fundVaultStore().liquidityItems[liquidityItemId] = liquidityItem;

        vaultData.totalShares -= oldSharesAmount - liquidityItem.shares;
        vaultData.totalCollateral -= oldAmount - amount;

        emit PositionDecreased(
            liquidityItemId,
            liquidityItem.fundId,
            liquidityItem.collateralType,
            amount,
            liquidityItem.leverage,
            shares,
            initialDebt
        );
    }

    function _calculateShares(
        uint fundId,
        address collateralType,
        uint collateralValue,
        uint leverage
    ) internal view returns (uint) {
        uint leveragedCollateralValue = collateralValue * leverage;
        uint totalShares = _totalShares(fundId, collateralType);
        uint totalCollateralValue = _totalCollateral(fundId, collateralType);

        return SharesLibrary.amountToShares(totalShares, totalCollateralValue, leveragedCollateralValue);
    }

    function _calculateInitialDebt(uint collateralValue, uint leverage) internal pure returns (uint) {
        return leverage * collateralValue;
    }

    // ---------------------------------------
    // Associated Rewards
    // ---------------------------------------

    function distributeRewards(
        uint fundId,
        address collateralType,
        uint index, 
        address distributor,
        uint amount,
        uint start,
        uint duration
    ) external override {
        if (index > MAX_REWARD_DISTRIBUTIONS) {
            revert InvalidParameters();
        }
        
        RewardDistribution storage existingDistribution = 
            _fundVaultStore().fundVaults[fundId][collateralType].rewards[index];

        // to call this function must be either:
        // 1. fund owner
        // 2. the registered distributor contract
        if (_ownerOf(fundId) != msg.sender && address(existingDistribution.distributor) != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        if ((_ownerOf(fundId) != msg.sender && distributor != msg.sender) || distributor == address(0)) {
            revert InvalidParameters();
        }

        // set stuff
        existingDistribution.distributor = IRewardsDistributor(distributor);
        existingDistribution.start = uint64(start);
        existingDistribution.duration = uint64(duration);

        // the amount is actually the amount distributed already *plus* whatever has been specified now
        uint alreadyDistributed = 0;
        existingDistribution.amount = uint128(amount);

        _updateRewards(fundId, collateralType, _totalShares(fundId, collateralType));

        emit RewardsDistributionSet(fundId, collateralType, index, distributor, amount, start, duration);
    }

    function claimRewards(uint fundId, address collateralType, uint accountId) external override onlyRoleAuthorized(accountId, "rewardsClaim") {
        RewardDistribution[] storage dists = 
            _fundVaultStore().fundVaults[fundId][collateralType].rewards;

        uint[] memory availableRewards = _getAvailableRewards(fundId, collateralType, accountId);

        for (uint i = 0;i < availableRewards.length;i++) {
            dists[i].lastAccumulated[accountId] = dists[i].accumulatedPerShare;

            // todo: reentrancy protection?
            dists[i].distributor.payout(fundId, collateralType, msg.sender, availableRewards[i]);

            emit RewardsClaimed(fundId, collateralType, accountId, i, availableRewards[i]);
        }
    }

    // this call is mutable but its intended to be used as a static call to see your current account rewards if you were to claim now
    function getAvailableRewards(uint fundId, address token, uint accountId) external returns (uint[] memory) {
        return _getAvailableRewards(fundId, token, accountId);
    }

    function _updateRewards(uint fundId, address collateralType, uint sharesSupply) internal {
        RewardDistribution[] storage dists = 
            _fundVaultStore().fundVaults[fundId][collateralType].rewards;

        uint curTime = block.timestamp;

        for (uint i = 0;i < dists.length;i++) {
            if (address(dists[i].distributor) == address(0) || dists[i].start > curTime) {
                continue;
            }

            // determine whether this is an instant distribution or a delayed distribution
            if (dists[i].duration == 0 && dists[i].lastUpdate < dists[i].start) {
                dists[i].accumulatedPerShare += dists[i].amount / uint128(sharesSupply);
            }
            else if (dists[i].lastUpdate < dists[i].start + dists[i].duration) {
                // find out what is "newly" distributed
                uint lastUpdateDistributed = dists[i].amount * (dists[i].lastUpdate - dists[i].start) / dists[i].duration;
                
                uint curUpdateDistributed = dists[i].amount * (curTime - dists[i].start) / dists[i].duration;
                if (dists[i].start + dists[i].duration < curTime) {
                    curUpdateDistributed = dists[i].amount;
                }

                dists[i].accumulatedPerShare += uint128((curUpdateDistributed - lastUpdateDistributed) / sharesSupply);
            }

            dists[i].lastUpdate = uint64(curTime);
        }
    }

    function _getAvailableRewards(uint fundId, address collateralType, uint accountId) internal returns (uint[] memory) {
        // get the current shares supply for update rewards
        

        _updateRewards(fundId, collateralType, _totalShares(fundId, collateralType));

        RewardDistribution[] storage dists = 
            _fundVaultStore().fundVaults[fundId][collateralType].rewards;

        uint curTime = block.timestamp;

        for (uint i = 0;i < dists.length;i++) {

        }
    }

    // ---------------------------------------
    // Mint/Burn USD
    // ---------------------------------------

    function mintUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "mint") {
        // TODO Check if can mint that amount

        _getToken(_USD_TOKEN).mint(msg.sender, amount);
        _fundVaultStore().fundVaults[fundId][collateralType].usdByAccount[accountId] += amount;
        _fundVaultStore().fundVaults[fundId][collateralType].totalUSD += amount;
    }

    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "burn") {
        // TODO Check if can burn that amount

        _getToken(_USD_TOKEN).burn(msg.sender, amount);
        _fundVaultStore().fundVaults[fundId][collateralType].usdByAccount[accountId] -= amount;
        _fundVaultStore().fundVaults[fundId][collateralType].totalUSD -= amount;
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function collateralizationRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        return _collateralizationRatio(fundId, accountId, collateralType);
    }

    function accountFundCollateralValue(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        (, uint accountCollateralValue) = _accountDebtAndCollateral(accountId, fundId, collateralType);
        return accountCollateralValue;
    }

    function accountFundDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        (uint accountDebt, ) = _accountDebtAndCollateral(accountId, fundId, collateralType);
        return accountDebt;
    }

    function fundDebt(uint fundId, address collateralType) public view override returns (uint) {
        return
            _totalShares(fundId, collateralType).mulDecimal(_debtPerShare(fundId, collateralType)) +
            _fundVaultStore().fundVaults[fundId][collateralType].totalUSD;
    }

    function totalDebtShares(uint fundId, address collateralType) external view override returns (uint) {
        return _totalShares(fundId, collateralType);
    }

    function debtPerShare(uint fundId, address collateralType) external view override returns (uint) {
        return _debtPerShare(fundId, collateralType);
    }

    function _debtPerShare(uint fundId, address collateralType) internal view returns (uint) {
        return _perShareCollateral(fundId, collateralType).mulDecimal(_getCollateralValue(collateralType));
    }

    // ---------------------------------------
    // Views
    // ---------------------------------------

    function getLiquidityItem(bytes32 liquidityItemId) public view override returns (LiquidityItem memory liquidityItem) {
        return _fundVaultStore().liquidityItems[liquidityItemId];
    }

    function getAccountLiquidityItemIds(uint accountId) public view override returns (bytes32[] memory liquidityItemIds) {
        return _fundVaultStore().accountliquidityItems[accountId].values();
    }

    function getAccountLiquidityItems(uint accountId)
        external
        view
        override
        returns (LiquidityItem[] memory liquidityItems)
    {
        bytes32[] memory liquidityItemIds = getAccountLiquidityItemIds(accountId);

        liquidityItems = new LiquidityItem[](liquidityItemIds.length);

        for (uint i = 0; i < liquidityItemIds.length; i++) {
            liquidityItems[i] = getLiquidityItem(liquidityItemIds[i]);
        }

        return liquidityItems;
    }

    // ---------------------------------------
    // Helpers / Internals
    // ---------------------------------------

    function _getLiquidityItemId(
        uint accountId,
        uint fundId,
        address collateralType
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(accountId, fundId, collateralType));
    }
}
