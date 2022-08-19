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

    using SharesLibrary for SharesLibrary.Distribution;

    uint private constant _MAX_REWARD_DISTRIBUTIONS = 10;
    bytes32 private constant _USD_TOKEN = "USDToken";

    error InvalidLeverage(uint leverage);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);
    error InsufficientDebt(int currentDebt);

    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint collateralAmount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) fundExists(fundId) {
        // Fix leverage to 1 until it's enabled
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        _updateAvailableRewards(vaultData, accountId);

        LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        // get the current collateral situation
        (uint oldCollateralAmount,,) = _accountCollateral(accountId, fundId, collateralType);

        // if increasing collateral additionally check they have enough collateral
        if (
            collateralAmount > oldCollateralAmount && 
            _getAccountUnassignedCollateral(accountId, collateralType) < collateralAmount - oldCollateralAmount
        ) {
            revert InsufficientAccountCollateral(accountId, collateralType, collateralAmount);
        }

        // stack too deep after this
        {
            // if decreasing collateral additionally check they have sufficient c-ratio

            _distributeVaultDebt(fundId, collateralType);

            uint shares = _calculateShares(vaultData, collateralAmount, leverage);

            if (shares == 0) {
                revert InvalidParameters("amount", "must be large enough for 1 share");
            }

            liquidityItem.cumulativeDebt += 
                int128(vaultData.debtDist.updateDistributionActor(bytes32(accountId), shares));
            
            vaultData.totalCollateral = uint128(
                vaultData.totalCollateral + 
                collateralAmount - 
                oldCollateralAmount
            );

            liquidityItem.leverage = uint128(leverage);

            _updateAccountDebt(accountId, fundId, collateralType);

            // this is the most efficient time to check the resulting collateralization ratio, since 
            // user's debt and collateral price have been fully updated
            if (collateralAmount < oldCollateralAmount) {
                int debt = int(liquidityItem.cumulativeDebt) + int128(liquidityItem.usdMinted);
                
                _verifyCollateralRatio(
                    collateralType, 
                    debt < 0 ? 0 : uint(debt), 
                    collateralAmount.mulDecimal(vaultData.collateralPrice)
                );
            }
        }

        emit DelegationUpdated(_getLiquidityItemId(accountId, fundId, collateralType), accountId, fundId, collateralType, collateralAmount, leverage);
    }

    function _calculateShares(
        VaultData storage vaultData,
        uint collateralAmount,
        uint leverage
    ) internal view returns (uint) {
        return uint(vaultData.debtDist.totalShares) * collateralAmount / vaultData.totalCollateral * leverage;
    }

    function _calculateInitialDebt(uint collateralValue, uint leverage) internal pure returns (uint) {
        return collateralValue.mulDecimal(leverage);
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
        if (index > _MAX_REWARD_DISTRIBUTIONS) {
            revert InvalidParameters("index", "too large");
        }

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        RewardDistribution[] storage dists = vaultData.rewards;

        if (index > dists.length) {
            revert InvalidParameters("index", "should be next index");
        }
        else if (index == dists.length) {
            dists.push(); // extend the size of the array by 1
        }

        RewardDistribution storage existingDistribution = dists[index];

        // to call this function must be either:
        // 1. fund owner
        // 2. the registered distributor contract
        if (_ownerOf(fundId) != msg.sender && address(existingDistribution.distributor) != msg.sender) {
            revert AccessError.Unauthorized(msg.sender);
        }

        if ((_ownerOf(fundId) != msg.sender && distributor != msg.sender) || distributor == address(0)) {
            revert InvalidParameters("distributor", "must be non-zero");
        }

        uint curTime = block.timestamp;

        existingDistribution.rewardPerShare += uint128(uint(
            vaultData.debtDist.distributeWithEntry(existingDistribution.entry, int(amount), start, duration)));

        emit RewardDistributionSet(fundId, collateralType, index, distributor, amount, start, duration);
    }

    function getAvailableRewards(
        uint fundId,
        address collateralType,
        uint accountId
    ) external override onlyRoleAuthorized(accountId, "assign") returns (uint[] memory) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        return _updateAvailableRewards(vaultData, accountId);
    }

    function getCurrentRewardAccumulation(
        uint fundId,
        address collateralType
    ) external override view returns (uint[] memory) {

        return _getCurrentRewardAccumulation(fundId, collateralType);
    }

    function claimRewards(
        uint fundId,
        address collateralType,
        uint accountId
    ) external override returns (uint[] memory) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        uint[] memory rewards = _updateAvailableRewards(vaultData, accountId);

        for (uint i = 0; i < rewards.length; i++) {
            if (rewards[i] > 0) {
                // todo: reentrancy protection?
                vaultData.rewards[i].distributor.payout(fundId, collateralType, msg.sender, rewards[i]);
                emit RewardsClaimed(fundId, collateralType, accountId, i, rewards[i]);
            }
        }

        return rewards;
    }

    function _updateAvailableRewards(
        VaultData storage vaultData,
        uint accountId
    ) internal returns (uint[] memory) {
        RewardDistribution[] storage dists = vaultData.rewards;

        uint totalShares = vaultData.debtDist.totalShares;

        uint[] memory rewards = new uint[](dists.length);
        for (uint i = 0; i < dists.length; i++) {
            if (address(dists[i].distributor) == address(0)) {
                continue;
            }

            dists[i].rewardPerShare += uint128(SharesLibrary.updateDistributionEntry(dists[i].entry, totalShares));

            dists[i].actorInfo[accountId].pendingSend += uint128(vaultData.debtDist.getActorShares(bytes32(accountId)) * 
                dists[i].actorInfo[accountId].lastRewardPerShare / 
                dists[i].rewardPerShare);

            dists[i].actorInfo[accountId].lastRewardPerShare = dists[i].rewardPerShare;

            rewards[i] = dists[i].actorInfo[accountId].pendingSend;
        }

        return rewards;
    }

    function _getCurrentRewardAccumulation(
        uint fundId,
        address collateralType
    ) internal view returns (uint[] memory) {
        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];
        RewardDistribution[] storage dists = vaultData.rewards;

        int curTime = int(block.timestamp);

        uint[] memory rates = new uint[](dists.length);

        for (uint i = 0; i < dists.length; i++) {
            if (
                address(dists[i].distributor) == address(0) || 
                dists[i].entry.start > curTime ||
                dists[i].entry.start + dists[i].entry.duration <= curTime
            ) {
                continue;
            }

            rates[i] = uint(int(dists[i].entry.scheduledValue))
                .divDecimal(uint(int(dists[i].entry.duration))
                .divDecimal(vaultData.debtDist.totalShares));
        }

        return rates;
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
        // check if they have sufficient c-ratio to mint that amount
        int debt = _updateAccountDebt(accountId, fundId, collateralType);
        (uint collateralValue,,) = _accountCollateral(accountId, fundId, collateralType);

        int newDebt = debt + int(amount);

        if (newDebt > 0) {
            _verifyCollateralRatio(collateralType, uint(newDebt), collateralValue);
        }

        _fundVaultStore().liquidityItems[_getLiquidityItemId(accountId, fundId, collateralType)].usdMinted += uint128(amount);

        _getToken(_USD_TOKEN).mint(msg.sender, amount);
    }

    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "burn") {
        int debt = _updateAccountDebt(accountId, fundId, collateralType);

        if (debt < 0) {
            // user shouldn't be able to burn more usd if they already have negative debt
            revert InsufficientDebt(debt);
        }

        LiquidityItem storage li = _fundVaultStore().liquidityItems[_getLiquidityItemId(accountId, fundId, collateralType)];

        if (debt < int(amount)) {
            amount = uint(debt);
        }

        // pay off usdMinted first (order doesn't really matter since it all becomes debt anyway)

        if (li.usdMinted > amount) {
            li.usdMinted -= uint128(amount);
        }
        else {
            li.cumulativeDebt -= int128(int(amount)) - int128(li.usdMinted);
            li.usdMinted = 0;
        }

        _getToken(_USD_TOKEN).burn(msg.sender, amount);
    }

    // ---------------------------------------
    // CRatio and Debt queries
    // ---------------------------------------

    function accountCollateralRatio(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (uint) {
        return _accountCollateralRatio(fundId, accountId, collateralType);
    }

    function accountFundCollateralValue(
        uint accountId,
        uint fundId,
        address collateralType
    ) external view override returns (uint) {
        (, uint accountCollateralValue, ) = _accountCollateral(accountId, fundId, collateralType);
        return accountCollateralValue;
    }

    function accountFundDebt(
        uint accountId,
        uint fundId,
        address collateralType
    ) external override returns (int) {
        return _updateAccountDebt(accountId, fundId, collateralType);
    }

    function fundDebt(uint fundId, address collateralType) public override returns (int) {

        _distributeVaultDebt(fundId, collateralType);

        return _fundVaultStore().fundVaults[fundId][collateralType].totalDebt;
    }

    function totalDebtShares(uint fundId, address collateralType) external view override returns (uint) {
        return _fundVaultStore().fundVaults[fundId][collateralType].debtDist.totalShares;
    }

    function debtPerShare(uint fundId, address collateralType) external override returns (int) {
        _distributeVaultDebt(fundId, collateralType);

        return _fundVaultStore().fundVaults[fundId][collateralType].totalDebt /
            int128(_fundVaultStore().fundVaults[fundId][collateralType].debtDist.totalShares);
    }

    function _verifyCollateralRatio(address collateralType, uint debt, uint collateralValue) internal view {
        uint targetCratio = _getCollateralTargetCRatio(collateralType);

        if (debt != 0 && collateralValue.divDecimal(debt) > targetCratio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), targetCratio);
        }
    }

    // ---------------------------------------
    // Views
    // ---------------------------------------

    function getLiquidityItem(bytes32 liquidityItemId) public view override returns (LiquidityItem memory liquidityItem) {
        return _fundVaultStore().liquidityItems[liquidityItemId];
    }

    function getAccountLiquidityItemIds(uint accountId) public view override returns (bytes32[] memory liquidityItemIds) {
        // TODO: generate liquidity item ids from list of available fund colalteral types
        return new bytes32[](0);
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
}
