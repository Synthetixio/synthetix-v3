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
    error InsufficientDebt(uint burnedAmount, uint currentDebt);

    function delegateCollateral(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount,
        uint leverage
    ) external override onlyRoleAuthorized(accountId, "assign") collateralEnabled(collateralType) fundExists(fundId) {
        // Fix leverage to 1 until it's enabled
        if (leverage != MathUtil.UNIT) revert InvalidLeverage(leverage);

        VaultData storage vaultData = _fundVaultStore().fundVaults[fundId][collateralType];

        _getAvailableRewards(fundId, collateralType, accountId);

        uint collateralValue = amount.mulDecimal(_getCollateralValue(collateralType));

        LiquidityItem storage liquidityItem = _fundVaultStore().liquidityItems[
            _getLiquidityItemId(accountId, fundId, collateralType)
        ];

        // if increasing collateral additionally check they have enough collateral
        if (amount > liquidityItem.collateralAmount && _getAccountUnassignedCollateral(accountId, collateralType) < amount - liquidityItem.collateralAmount) {
            revert InsufficientAccountCollateral(accountId, collateralType, amount);
        }

        // stack too deep after this
        {
            uint minCratio = _getCollateralMinimumCRatio(collateralType);

            // update debt distributions
            int newDebt = liquidityItem.lastDebt + 
                vaultData.debtDist.updateDistributionActor(accountId, liquidityItem.shares, vaultData.totalShares);

            // TODO
            int baseDebt = 0;

            // if decreasing collateral additionally check they have sufficient c-ratio
            _verifyCollateralRatio(collateralType, newDebt, collateralValue);

            _distributeVaultAccountDebt(fundId, collateralType);

            uint shares = _calculateShares(fundId, collateralType, collateralValue, leverage);

            if (shares == 0) {
                revert InvalidParameters("amount", "must be large enough for 1 share");
            }

            liquidityItem.cumulativeDebt += vaultData.debtDist.updateDistributionActor(bytes32(accountId), shares);
            vaultData.totalCollateral = uint128(vaultData.totalCollateral + amount - liquidityItem.collateralAmount);
            
            liquidityItem.shares = uint128(shares);
            liquidityItem.collateralAmount = uint128(amount);

            liquidityItem.lastDebt = int128(newDebt);

            liquidityItem.leverage = uint128(leverage);
        }

        _updateAccountDebt(accountId, fundId, collateralType);

        emit DelegationUpdated(_getLiquidityItemId(accountId, fundId, collateralType), accountId, fundId, collateralType, amount, leverage);
    }

    function _calculateShares(
        FundVaultStorage storage vaultData,
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

        RewardDistribution[] storage dists = _fundVaultStore().fundVaults[fundId][collateralType].rewards;

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
        uint totalShares = _totalShares(fundId, collateralType);

        existingDistribution.reward
            .distribute(totalShares, int(amount), start, duration);

        emit RewardDistributionSet(fundId, collateralType, index, distributor, amount, start, duration);
    }

    function claimRewards(
        uint fundId,
        address collateralType,
        uint accountId
    ) external override onlyRoleAuthorized(accountId, "assign") returns (uint[] memory) {
        return _getAvailableRewards(fundId, collateralType, accountId);
    }

    function getCurrentRewardAccumulation(
        uint fundId,
        address collateralType
    ) external override view returns (uint[] memory) {
        return _getCurrentRewardAccumulation(fundId, collateralType, _totalShares(fundId, collateralType));
    }

    function _getAvailableRewards(
        uint fundId,
        address collateralType,
        uint accountId
    ) internal returns (uint[] memory) {
        (, , uint accountShares) = _accountCollateral(accountId, fundId, collateralType);
        //return new uint[](0);

        RewardDistribution[] storage dists = _fundVaultStore().fundVaults[fundId][collateralType].rewards;

        uint sharesSupply = _totalShares(fundId, collateralType);

        uint[] memory rewards = new uint[](dists.length);
        for (uint i = 0; i < dists.length; i++) {
            if (address(dists[i].distributor) == address(0)) {
                continue;
            }

            rewards[i] = uint(dists[i].reward
                .updateDistributionActor(accountId, accountShares, sharesSupply));
            
            // todo: reentrancy protection?
            if (rewards[i] > 0) {
                dists[i].distributor.payout(fundId, collateralType, msg.sender, rewards[i]);
                emit RewardsClaimed(fundId, collateralType, accountId, i, rewards[i]);
            }
        }

        return rewards;
    }

    function _getCurrentRewardAccumulation(
        uint fundId,
        address collateralType,
        uint sharesSupply
    ) internal view returns (uint[] memory) {
        RewardDistribution[] storage dists = _fundVaultStore().fundVaults[fundId][collateralType].rewards;

        int curTime = int(block.timestamp);

        uint[] memory rates = new uint[](dists.length);

        for (uint i = 0; i < dists.length; i++) {
            if (
                address(dists[i].distributor) == address(0) || 
                dists[i].reward.start > curTime ||
                dists[i].reward.start + dists[i].reward.duration <= curTime
            ) {
                continue;
            }

            rates[i] = uint(int(dists[i].reward.amount))
                .divDecimal(uint(int(dists[i].reward.duration))
                .divDecimal(sharesSupply));
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
        uint debt = _accountDebt(accountId, fundId, collateralType);
        (uint collateralValue,,) = _accountCollateral(accountId, fundId, collateralType);

        _verifyCollateralRatio(collateralType, debt + amount, collateralValue);

        _fundVaultStore().liquidityItems[_getLiquidityItemId(accountId, fundId, collateralType)].usdMinted += amount;

        _getToken(_USD_TOKEN).mint(msg.sender, amount);
    }

    function burnUSD(
        uint accountId,
        uint fundId,
        address collateralType,
        uint amount
    ) external override onlyRoleAuthorized(accountId, "burn") {
        // check if can burn that amount

        uint debt = _accountDebt(accountId, fundId, collateralType);

        LiquidityItem storage li = _fundVaultStore().liquidityItems[_getLiquidityItemId(accountId, fundId, collateralType)];

        if (debt < amount) {
            amount = debt;
        }

        // pay off usdMinted first (order doesn't really matter since it all becomes debt anyway)

        if (li.usdMinted > amount) {
            li.usdMinted -= amount;
        }
        else {
            li.lastDebt -= amount - li.usdMinted;
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
    ) external view override returns (uint) {
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
    ) external override returns (uint) {
        uint accountDebt = _accountDebt(accountId, fundId, collateralType);
        return accountDebt;
    }

    function fundDebt(uint fundId, address collateralType) public override returns (uint) {

        _distributeDebt(fundId, collateralType);

        return _fundVaultStore().lastDebt;
    }

    function totalDebtShares(uint fundId, address collateralType) external view override returns (uint) {
        return _totalShares(fundId, collateralType);
    }

    function debtPerShare(uint fundId, address collateralType) external override returns (uint) {
        _distributeDebt(fundId, collateralType);

        return _fundVaultStore().lastDebt / _totalShares(fundId, collateralType);
    }

    function _verifyCollateralRatio(address collateralType, uint debt, uint collateralValue) internal view returns (uint) {
        uint minCratio = _getCollateralMinimumCRatio(collateralType);

        if (debt != 0 && collateralValue.divDecimal(debt) > minCratio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), minCratio);
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
