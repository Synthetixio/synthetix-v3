//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IIssueUSDModule.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../storage/Account.sol";
import "../../storage/Pool.sol";
import "../../storage/CollateralConfiguration.sol";

/**
 * @title Module for the minting and burning of stablecoins.
 * @dev See IIssueUSDModule.
 */
contract IssueUSDModule is IIssueUSDModule {
    using AccountRBAC for AccountRBAC.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using Pool for Pool.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using ScalableMapping for ScalableMapping.Data;

    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    bytes32 private constant _USD_TOKEN = "USDToken";

    /**
     * @inheritdoc IIssueUSDModule
     */
    function mintUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 amount
    ) external override {
        // Ensure the caller is allowed to mint
        _onlyWithPermission(accountId, AccountRBAC._MINT_PERMISSION);

        Pool.Data storage pool = Pool.load(poolId);

        int256 debt = pool.updateAccountDebt(collateralType, accountId);
        int256 newDebt = debt + amount.toInt();

        // Ensure minting stablecoins is increasing the debt of the position
        require(newDebt > debt, "Incorrect new debt");

        // If the resulting debt of the account is greater than zero, ensure that the resulting c-ratio is sufficient
        (, uint256 collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        if (newDebt > 0) {
            CollateralConfiguration.load(collateralType).verifyIssuanceRatio(
                newDebt.toUint(),
                collateralValue
            );
        }

        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        // Increase the debt of the position
        epoch.assignDebtToAccount(accountId, amount.toInt());

        // Decrease the credit available in the vault
        pool.recalculateVaultCollateral(collateralType);

        // Mint stablecoins to the sender
        AssociatedSystem.load(_USD_TOKEN).asToken().mint(msg.sender, amount);

        emit UsdMinted(accountId, poolId, collateralType, amount, msg.sender);
    }

    /**
     * @inheritdoc IIssueUSDModule
     */
    function burnUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 amount
    ) external override {
        Pool.Data storage pool = Pool.load(poolId);

        // Retrieve current position debt
        int256 debt = pool.updateAccountDebt(collateralType, accountId);

        // Ensure the position can't burn if it already has no debt
        if (debt <= 0) {
            revert InsufficientDebt(debt);
        }

        // Only allow burning the total debt of the position
        if (debt < amount.toInt()) {
            amount = debt.toUint();
        }

        // Burn the stablecoins
        AssociatedSystem.load(_USD_TOKEN).asToken().burn(msg.sender, amount);

        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        // Decrease the debt of the position
        epoch.assignDebtToAccount(accountId, -amount.toInt());

        // Increase the credit available in the vault
        pool.recalculateVaultCollateral(collateralType);

        emit UsdBurned(accountId, poolId, collateralType, amount, msg.sender);
    }

    /**
     * @dev Reverts if the given account does not have the specified permission.
     */
    // Note: Disabling Solidity warning, not sure why it suggests pure mutability.
    // solc-ignore-next-line func-mutability
    function _onlyWithPermission(uint128 accountId, bytes32 permission) internal {
        if (!Account.load(accountId).rbac.authorized(permission, msg.sender)) {
            revert Account.PermissionDenied(accountId, permission, msg.sender);
        }
    }
}
