//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "../../storage/Account.sol";
import "../../storage/Pool.sol";
import "../../storage/AccountDelegationIntents.sol";

import "../../interfaces/IVaultIntentViewsModule.sol";

/**
 * @title Views for Delegation Intents for Vault.
 * @dev See IVaultIntentViewsModule.
 */
contract VaultIntentViewsModule is IVaultIntentViewsModule {
    using SetUtil for SetUtil.UintSet;
    using DecimalMath for uint256;
    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Collateral for Collateral.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;
    using AccountDelegationIntents for AccountDelegationIntents.Data;
    using DelegationIntent for DelegationIntent.Data;
    using Account for Account.Data;

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getAccountIntent(
        uint128 accountId,
        uint256 intentId
    ) external view override returns (uint128, address, int256, uint256, uint32, uint32, uint32) {
        DelegationIntent.Data storage intent = Account
            .load(accountId)
            .getDelegationIntents()
            .getIntent(intentId);
        return (
            intent.poolId,
            intent.collateralType,
            intent.deltaCollateralAmountD18,
            intent.leverage,
            intent.declarationTime,
            intent.processingStartTime(),
            intent.processingEndTime()
        );
    }

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getAccountIntentIds(
        uint128 accountId
    ) external view override returns (uint256[] memory) {
        return Account.load(accountId).getDelegationIntents().intentsId.values();
    }

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getAccountExpiredIntentIds(
        uint128 accountId,
        uint256 maxProcessableIntent
    ) external view override returns (uint256[] memory expiredIntents, uint256 foundItems) {
        uint256[] memory allIntents = Account
            .load(accountId)
            .getDelegationIntents()
            .intentsId
            .values();
        uint256 max = maxProcessableIntent > allIntents.length
            ? allIntents.length
            : maxProcessableIntent;
        expiredIntents = new uint256[](max);
        for (uint256 i = 0; i < max; i++) {
            if (DelegationIntent.load(allIntents[i]).intentExpired()) {
                expiredIntents[foundItems] = allIntents[i];
                foundItems++;
            }
        }
    }

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getAccountExecutableIntentIds(
        uint128 accountId,
        uint256 maxProcessableIntent
    ) external view override returns (uint256[] memory executableIntents, uint256 foundItems) {
        uint256[] memory allIntents = Account
            .load(accountId)
            .getDelegationIntents()
            .intentsId
            .values();
        uint256 max = maxProcessableIntent > allIntents.length
            ? allIntents.length
            : maxProcessableIntent;
        executableIntents = new uint256[](max);
        for (uint256 i = 0; i < max; i++) {
            if (DelegationIntent.load(allIntents[i]).isExecutable()) {
                executableIntents[foundItems] = allIntents[i];
                foundItems++;
            }
        }
    }

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getIntentDelegatedPerCollateral(
        uint128 accountId,
        address collateralType
    ) external view override returns (uint256) {
        return
            Account.load(accountId).getDelegationIntents().delegatedAmountPerCollateral[
                collateralType
            ];
    }

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getIntentUndelegatedPerCollateral(
        uint128 accountId,
        address collateralType
    ) external view override returns (uint256) {
        return
            Account.load(accountId).getDelegationIntents().unDelegatedAmountPerCollateral[
                collateralType
            ];
    }

    /**
     * @inheritdoc IVaultIntentViewsModule
     */
    function getExecutableDelegationAccumulated(
        uint128 accountId,
        uint128 poolId,
        address collateralType
    ) external view override returns (int256 accumulatedIntentDelta) {
        uint256[] memory intentIds = Account.load(accountId).getDelegationIntents().intentIdsByPair(
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
}
