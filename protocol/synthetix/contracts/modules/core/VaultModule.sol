//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../storage/Account.sol";
import "../../storage/Pool.sol";
import "../../storage/AccountDelegationIntents.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "../../interfaces/IVaultModule.sol";

/**
 * @title Allows accounts to delegate collateral to a pool.
 * @dev See IVaultModule.
 */
contract VaultModule is IVaultModule {
    using SetUtil for SetUtil.UintSet;
    using SetUtil for SetUtil.Bytes32Set;
    using SetUtil for SetUtil.AddressSet;
    using DecimalMath for uint256;
    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Collateral for Collateral.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using AccountRBAC for AccountRBAC.Data;
    using Distribution for Distribution.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using ScalableMapping for ScalableMapping.Data;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using AccountDelegationIntents for AccountDelegationIntents.Data;
    using DelegationIntent for DelegationIntent.Data;

    bytes32 private constant _DELEGATE_FEATURE_FLAG = "delegateCollateral";

    /**
     * @inheritdoc IVaultModule
     */
    function declareIntentToDelegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        int256 deltaCollateralAmountD18,
        uint256 leverage
    ) external override returns (uint256 intentId) {
        // Ensure the caller is authorized to represent the account.
        FeatureFlag.ensureAccessToFeature(_DELEGATE_FEATURE_FLAG);
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._DELEGATE_PERMISSION);

        // Input checks
        // System only supports leverage of 1.0 for now.
        if (leverage != DecimalMath.UNIT) revert InvalidLeverage(leverage);
        // Ensure current collateral amount differs from the new collateral amount.
        if (deltaCollateralAmountD18 == 0) revert InvalidCollateralAmount();

        // Verify the account holds enough collateral to execute the intent.
        // Get previous intents cache
        AccountDelegationIntents.Data storage accountIntents = AccountDelegationIntents.getValid(
            accountId
        );

        // Identify the vault that corresponds to this collateral type and pool id.
        Vault.Data storage vault = Pool.loadExisting(poolId).vaults[collateralType];

        uint256 currentCollateralAmount = vault.currentAccountCollateral(accountId);
        int256 accumulatedDelta = deltaCollateralAmountD18 +
            accountIntents.netDelegatedAmountPerCollateral[collateralType];
        if (accumulatedDelta < 0 && currentCollateralAmount < (-1 * accumulatedDelta).toUint()) {
            revert ExceedingUndelegateAmount(
                deltaCollateralAmountD18,
                accountIntents.netDelegatedAmountPerCollateral[collateralType],
                accumulatedDelta,
                currentCollateralAmount
            );
        }

        uint256 newCollateralAmountD18 = (currentCollateralAmount.toInt() + accumulatedDelta)
            .toUint();

        // Each collateral type may specify a minimum collateral amount that can be delegated.
        // See CollateralConfiguration.minDelegationD18.
        if (newCollateralAmountD18 > 0) {
            CollateralConfiguration.requireSufficientDelegation(
                collateralType,
                newCollateralAmountD18
            );
        }
        // Check the validity of the collateral amount to be delegated, respecting the caches that track outstanding intents to delegate or undelegate collateral.
        // If increasing delegated collateral amount,
        // Check that the account has sufficient collateral.
        if (newCollateralAmountD18 > currentCollateralAmount) {
            // Check if the collateral is enabled here because we still want to allow reducing delegation for disabled collaterals.
            CollateralConfiguration.collateralEnabled(collateralType);

            Account.requireSufficientCollateral(
                accountId,
                collateralType,
                newCollateralAmountD18 - currentCollateralAmount
            );

            Pool.loadExisting(poolId).checkPoolCollateralLimit(
                collateralType,
                newCollateralAmountD18 - currentCollateralAmount
            );
        }

        // Create a new delegation intent.
        intentId = DelegationIntent.nextId();
        DelegationIntent.Data storage intent = DelegationIntent.load(intentId);
        intent.id = intentId;
        intent.accountId = accountId;
        intent.poolId = poolId;
        intent.collateralType = collateralType;
        intent.deltaCollateralAmountD18 = deltaCollateralAmountD18;
        intent.leverage = leverage;
        intent.declarationTime = block.timestamp.to32();

        // Add intent to the account's delegation intents.
        AccountDelegationIntents.getValid(intent.accountId).addIntent(intent);

        // emit an event
        emit DelegationIntentDeclared(
            accountId,
            poolId,
            collateralType,
            deltaCollateralAmountD18,
            leverage,
            intentId,
            intent.declarationTime,
            intent.processingStartTime(),
            intent.processingEndTime(),
            ERC2771Context._msgSender()
        );
    }

    /**
     * @inheritdoc IVaultModule
     */
    function processIntentToDelegateCollateralByIntents(
        uint128 accountId,
        uint256[] memory intentIds
    ) public override {
        FeatureFlag.ensureAccessToFeature(_DELEGATE_FEATURE_FLAG);
        AccountDelegationIntents.Data storage accountIntents = AccountDelegationIntents.loadValid(
            accountId
        );
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            if (!accountIntents.isInCurrentEpoch(intent.id)) {
                revert DelegationIntentNotInCurrentEpoch(intent.id);
            }

            if (!intent.isExecutable()) {
                // emit an Skipped event
                emit DelegationIntentSkipped(
                    intent.id,
                    accountId,
                    intent.poolId,
                    intent.collateralType
                );

                // If expired, remove the intent.
                if (intent.intentExpired()) {
                    AccountDelegationIntents.getValid(accountId).removeIntent(intent);
                    emit DelegationIntentRemoved(
                        intent.id,
                        accountId,
                        intent.poolId,
                        intent.collateralType
                    );
                }

                // skip to the next intent
                continue;
            }

            // Ensure the intent is valid.
            if (intent.accountId != accountId) revert InvalidDelegationIntent();

            // Process the intent.
            _delegateCollateral(
                accountId,
                intent.poolId,
                intent.collateralType,
                intent.deltaCollateralAmountD18,
                intent.leverage
            );

            // Remove the intent.
            AccountDelegationIntents.getValid(accountId).removeIntent(intent);
            emit DelegationIntentRemoved(
                intent.id,
                accountId,
                intent.poolId,
                intent.collateralType
            );

            // emit an event
            emit DelegationIntentProcessed(
                intent.id,
                accountId,
                intent.poolId,
                intent.collateralType
            );
        }
    }

    /**
     * @inheritdoc IVaultModule
     */
    function processIntentToDelegateCollateralByPair(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override {
        processIntentToDelegateCollateralByIntents(
            accountId,
            AccountDelegationIntents.getValid(accountId).intentIdsByPair(poolId, collateralType)
        );
    }

    /**
     * @inheritdoc IVaultModule
     */
    function forceDeleteAllAccountIntents(uint128 accountId) external override {
        OwnableStorage.onlyOwner();
        AccountDelegationIntents.getValid(accountId).cleanAllIntents();
    }

    /**
     * @inheritdoc IVaultModule
     */
    function forceDeleteIntents(uint128 accountId, uint256[] calldata intentIds) external override {
        OwnableStorage.onlyOwner();
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            AccountDelegationIntents.getValid(accountId).removeIntent(intent);
        }
    }

    /**
     * @inheritdoc IVaultModule
     */
    function deleteAllExpiredIntents(uint128 accountId) external override {
        AccountDelegationIntents.getValid(accountId).cleanAllExpiredIntents();
    }

    /**
     * @inheritdoc IVaultModule
     */
    function deleteExpiredIntents(
        uint128 accountId,
        uint256[] calldata intentIds
    ) external override {
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            if (intent.accountId != accountId) {
                revert InvalidDelegationIntent();
            }
            if (!intent.intentExpired()) {
                revert DelegationIntentNotExpired(intent.id);
            }
            AccountDelegationIntents.getValid(accountId).removeIntent(intent);
        }
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getPositionCollateralRatio(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (uint256) {
        return Pool.load(poolId).currentAccountCollateralRatio(collateralType, accountId);
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getVaultCollateralRatio(
        uint128 poolId,
        address collateralType
    ) external override returns (uint256) {
        return Pool.load(poolId).currentVaultCollateralRatio(collateralType);
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getPositionCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view override returns (uint256 amount) {
        return Pool.load(poolId).vaults[collateralType].currentAccountCollateral(accountId);
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getPosition(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    )
        external
        override
        returns (
            uint256 collateralAmount,
            uint256 collateralValue,
            int256 debt,
            uint256 collateralizationRatio
        )
    {
        Pool.Data storage pool = Pool.load(poolId);

        debt = pool.updateAccountDebt(collateralType, accountId);
        pool.rebalanceMarketsInPool();
        (collateralAmount, collateralValue) = pool.currentAccountCollateral(
            collateralType,
            accountId
        );
        collateralizationRatio = pool.currentAccountCollateralRatio(collateralType, accountId);
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getPositionDebt(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external override returns (int256 debt) {
        Pool.Data storage pool = Pool.loadExisting(poolId);
        debt = pool.updateAccountDebt(collateralType, accountId);
        pool.rebalanceMarketsInPool();
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getVaultCollateral(
        uint128 poolId,
        address collateralType
    ) public view override returns (uint256 amount, uint256 value) {
        return Pool.loadExisting(poolId).currentVaultCollateral(collateralType);
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getVaultDebt(uint128 poolId, address collateralType) public override returns (int256) {
        return Pool.loadExisting(poolId).currentVaultDebt(collateralType);
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getAccountIntent(
        uint128 accountId,
        uint256 intentId
    ) external view override returns (uint128, address, int256, uint256, uint32) {
        DelegationIntent.Data storage intent = AccountDelegationIntents
            .loadValid(accountId)
            .getIntent(intentId);
        return (
            intent.poolId,
            intent.collateralType,
            intent.deltaCollateralAmountD18,
            intent.leverage,
            intent.declarationTime
        );
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getAccountIntentIds(
        uint128 accountId
    ) external view override returns (uint256[] memory) {
        return AccountDelegationIntents.loadValid(accountId).intentsId.values();
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getAccountExpiredIntentIds(
        uint128 accountId,
        uint256 maxProcessableIntent
    ) external view override returns (uint256[] memory expiredIntents, uint256 foundItems) {
        uint256[] memory allIntents = AccountDelegationIntents
            .loadValid(accountId)
            .intentsId
            .values();
        uint256 max = maxProcessableIntent > allIntents.length
            ? allIntents.length
            : maxProcessableIntent;
        expiredIntents = new uint256[](max);
        for (uint256 i = 0; i < max; i++) {
            if (DelegationIntent.load(allIntents[i]).intentExpired()) {
                expiredIntents[i] = allIntents[i];
                foundItems++;
            }
        }
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getAccountExecutableIntentIds(
        uint128 accountId,
        uint256 maxProcessableIntent
    ) external view override returns (uint256[] memory executableIntents, uint256 foundItems) {
        uint256[] memory allIntents = AccountDelegationIntents
            .loadValid(accountId)
            .intentsId
            .values();
        uint256 max = maxProcessableIntent > allIntents.length
            ? allIntents.length
            : maxProcessableIntent;
        executableIntents = new uint256[](max);
        for (uint256 i = 0; i < max; i++) {
            if (DelegationIntent.load(allIntents[i]).isExecutable()) {
                executableIntents[i] = allIntents[i];
                foundItems++;
            }
        }
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getNetDelegatedPerCollateral(
        uint128 accountId,
        address collateralType
    ) external view override returns (int256) {
        return
            AccountDelegationIntents.loadValid(accountId).netDelegatedAmountPerCollateral[
                collateralType
            ];
    }

    /**
     * @inheritdoc IVaultModule
     */
    function getExecutableDelegationAccumulated(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view override returns (int256 accumulatedIntentDelta) {
        uint256[] memory intentIds = AccountDelegationIntents.loadValid(accountId).intentIdsByPair(
            poolId,
            collateralType
        );
        accumulatedIntentDelta = 0;
        for (uint256 i = 0; i < intentIds.length; i++) {
            DelegationIntent.Data storage intent = DelegationIntent.load(intentIds[i]);
            if (!intent.intentExpired()) {
                accumulatedIntentDelta += intent.deltaCollateralAmountD18;
            }
        }
    }

    /**
     * @inheritdoc IVaultModule
     */
    function requiredDebtRepaymentForUndelegation(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        int256 deltaCollateralAmountD18,
        uint256 collateralPrice
    ) external view override returns (uint256) {
        // Identify the vault that corresponds to this collateral type and pool id.
        if (deltaCollateralAmountD18 > 0) {
            return 0;
        }

        Vault.Data storage vault = Pool.loadExisting(poolId).vaults[collateralType];

        int256 debt = vault.currentEpoch().consolidatedDebtAmountsD18[accountId];
        uint256 effectiveDebt = debt < 0 ? 0 : debt.toUint();
        if (effectiveDebt == 0) {
            return 0;
        }

        uint256 currentCollateralAmount = vault.currentAccountCollateral(accountId);

        if (currentCollateralAmount < (-1 * deltaCollateralAmountD18).toUint()) {
            revert ExceedingUndelegateAmount(
                deltaCollateralAmountD18,
                0,
                deltaCollateralAmountD18,
                currentCollateralAmount
            );
        }

        uint256 newCollateralAmountD18 = (currentCollateralAmount.toInt() +
            deltaCollateralAmountD18).toUint();

        uint256 minIssuanceRatioD18 = Pool
            .loadExisting(poolId)
            .collateralConfigurations[collateralType]
            .issuanceRatioD18;

        uint256 effectiveIssuanceRatioD18 = CollateralConfiguration
            .load(collateralType)
            .getEffectiveIssuanceRatio(minIssuanceRatioD18);

        // edge case. Issuance set to max
        if (effectiveIssuanceRatioD18 == type(uint256).max) {
            return effectiveDebt;
        }

        uint256 collateralValue = newCollateralAmountD18.mulDecimal(collateralPrice);

        uint256 maxDebt = effectiveIssuanceRatioD18.mulDecimal(collateralValue);
        if (maxDebt >= effectiveDebt) {
            return 0;
        }
        return maxDebt - effectiveDebt;
    }

    function _delegateCollateral(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        int256 deltaCollateralAmountD18,
        uint256 leverage
    ) internal {
        // Identify the vault that corresponds to this collateral type and pool id.
        Vault.Data storage vault = Pool.loadExisting(poolId).vaults[collateralType];

        // Use account interaction to update its rewards.
        uint256 totalSharesD18 = vault.currentEpoch().accountsDebtDistribution.totalSharesD18;
        uint256 actorSharesD18 = vault.currentEpoch().accountsDebtDistribution.getActorShares(
            accountId.toBytes32()
        );

        uint256 currentCollateralAmount = vault.currentAccountCollateral(accountId);

        uint256 newCollateralAmountD18 = (currentCollateralAmount.toInt() +
            deltaCollateralAmountD18).toUint();

        // Each collateral type may specify a minimum collateral amount that can be delegated.
        // See CollateralConfiguration.minDelegationD18.
        if (newCollateralAmountD18 > 0) {
            CollateralConfiguration.requireSufficientDelegation(
                collateralType,
                newCollateralAmountD18
            );
        }

        // Conditions for collateral amount

        // If increasing delegated collateral amount,
        // Check that the account has sufficient collateral.
        if (deltaCollateralAmountD18 > 0) {
            // Check if the collateral is enabled here because we still want to allow reducing delegation for disabled collaterals.
            CollateralConfiguration.collateralEnabled(collateralType);

            Account.requireSufficientCollateral(
                accountId,
                collateralType,
                deltaCollateralAmountD18.toUint()
            );

            Pool.loadExisting(poolId).checkPoolCollateralLimit(
                collateralType,
                deltaCollateralAmountD18.toUint()
            );
        }

        // Update the account's position for the given pool and collateral type,
        // Note: This will trigger an update in the entire debt distribution chain.
        uint256 collateralPrice = _updatePosition(
            accountId,
            poolId,
            collateralType,
            newCollateralAmountD18,
            currentCollateralAmount,
            leverage
        );

        _updateAccountCollateralPools(
            accountId,
            poolId,
            collateralType,
            newCollateralAmountD18 > 0
        );

        // If decreasing the delegated collateral amount,
        // check the account's collateralization ratio.
        // Note: This is the best time to do so since the user's debt and the collateral's price have both been updated.
        if (deltaCollateralAmountD18 < 0) {
            int256 debt = vault.currentEpoch().consolidatedDebtAmountsD18[accountId];

            uint256 minIssuanceRatioD18 = Pool
                .loadExisting(poolId)
                .collateralConfigurations[collateralType]
                .issuanceRatioD18;

            // Minimum collateralization ratios are configured in the system per collateral type.abi
            // Ensure that the account's updated position satisfies this requirement.
            CollateralConfiguration.load(collateralType).verifyIssuanceRatio(
                debt < 0 ? 0 : debt.toUint(),
                newCollateralAmountD18.mulDecimal(collateralPrice),
                minIssuanceRatioD18
            );

            // Accounts cannot reduce collateral if any of the pool's
            // connected market has its capacity locked.
            _verifyNotCapacityLocked(poolId);
        }

        emit DelegationUpdated(
            accountId,
            poolId,
            collateralType,
            newCollateralAmountD18,
            leverage,
            ERC2771Context._msgSender() // this is the executor address, not the account owner or authorized (the one that posted the intent)
        );

        vault.updateRewards(
            Vault.PositionSelector(accountId, poolId, collateralType),
            totalSharesD18,
            actorSharesD18
        );
    }

    /**
     * @dev Updates the given account's position regarding the given pool and collateral type,
     * with the new amount of delegated collateral.
     *
     * The update will be reflected in the registered delegated collateral amount,
     * but it will also trigger updates to the entire debt distribution chain.
     */
    function _updatePosition(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 newCollateralAmount,
        uint256 oldCollateralAmount,
        uint256 leverage
    ) internal returns (uint256 collateralPrice) {
        Pool.Data storage pool = Pool.load(poolId);

        // Trigger an update in the debt distribution chain to make sure that
        // the user's debt is up to date.
        pool.updateAccountDebt(collateralType, accountId);

        // Get the collateral entry for the given account and collateral type.
        Collateral.Data storage collateral = Account.load(accountId).collaterals[collateralType];

        // Adjust collateral depending on increase/decrease of amount.
        if (newCollateralAmount > oldCollateralAmount) {
            collateral.decreaseAvailableCollateral(newCollateralAmount - oldCollateralAmount);
        } else {
            collateral.increaseAvailableCollateral(oldCollateralAmount - newCollateralAmount);
        }

        // If the collateral amount is not negative, make sure that the pool exists
        // in the collateral entry's pool array. Otherwise remove it.
        _updateAccountCollateralPools(accountId, poolId, collateralType, newCollateralAmount > 0);

        // Update the account's position in the vault data structure.
        pool.vaults[collateralType].currentEpoch().updateAccountPosition(
            accountId,
            newCollateralAmount,
            leverage
        );

        // Trigger another update in the debt distribution chain,
        // and surface the latest price for the given collateral type (which is retrieved in the update).
        collateralPrice = pool.recalculateVaultCollateral(collateralType);
    }

    function _verifyNotCapacityLocked(uint128 poolId) internal view {
        Pool.Data storage pool = Pool.load(poolId);

        Market.Data storage market = pool.findMarketWithCapacityLocked();

        if (market.id > 0) {
            revert CapacityLocked(market.id);
        }
    }

    /**
     * @dev Registers the pool in the given account's collaterals array.
     */
    function _updateAccountCollateralPools(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        bool added
    ) internal {
        Collateral.Data storage depositedCollateral = Account.load(accountId).collaterals[
            collateralType
        ];

        bool containsPool = depositedCollateral.pools.contains(poolId);
        if (added && !containsPool) {
            depositedCollateral.pools.add(poolId);
        } else if (!added && containsPool) {
            depositedCollateral.pools.remove(poolId);
        }
    }
}
