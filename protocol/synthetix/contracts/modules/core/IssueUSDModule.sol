//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IIssueUSDModule.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../storage/Account.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/Config.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title Module for the minting and burning of stablecoins.
 * @dev See IIssueUSDModule.
 */
contract IssueUSDModule is IIssueUSDModule {
    using Account for Account.Data;
    using AccountRBAC for AccountRBAC.Data;
    using AssociatedSystem for AssociatedSystem.Data;
    using Pool for Pool.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using Distribution for Distribution.Data;
    using ScalableMapping for ScalableMapping.Data;

    using DecimalMath for uint256;
    using DecimalMath for int256;

    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;

    bytes32 private constant _USD_TOKEN = "USDToken";

    bytes32 private constant _MINT_FEATURE_FLAG = "mintUsd";
    bytes32 private constant _BURN_FEATURE_FLAG = "burnUsd";

    bytes32 private constant _CONFIG_MINT_FEE_RATIO = "mintUsd_feeRatio";
    bytes32 private constant _CONFIG_BURN_FEE_RATIO = "burnUsd_feeRatio";
    bytes32 private constant _CONFIG_MINT_FEE_ADDRESS = "mintUsd_feeAddress";
    bytes32 private constant _CONFIG_BURN_FEE_ADDRESS = "burnUsd_feeAddress";

    /**
     * @inheritdoc IIssueUSDModule
     */
    function mintUsd(
        uint128 accountId,
        uint128 poolId,
        address collateralType,
        uint256 amount
    ) external override {
        FeatureFlag.ensureAccessToFeature(_MINT_FEATURE_FLAG);
        Account.loadAccountAndValidatePermission(accountId, AccountRBAC._MINT_PERMISSION);

        // disabled collateralType cannot be used for minting
        CollateralConfiguration.collateralEnabled(collateralType);

        Pool.Data storage pool = Pool.loadExisting(poolId);

        int256 debt = pool.updateAccountDebt(collateralType, accountId);
        int256 newDebt = debt + amount.toInt();

        // Ensure minting stablecoins is increasing the debt of the position
        if (newDebt <= debt) {
            revert ParameterError.InvalidParameter(
                "newDebt",
                "should be greater than current debt"
            );
        }

        uint256 feeAmount = amount.mulDecimal(Config.readUint(_CONFIG_MINT_FEE_RATIO, 0));
        address feeAddress = feeAmount > 0
            ? Config.readAddress(_CONFIG_MINT_FEE_ADDRESS, address(0))
            : address(0);

        newDebt += feeAmount.toInt();

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
        epoch.assignDebtToAccount(accountId, (amount + feeAmount).toInt());

        // Decrease the credit available in the vault
        pool.recalculateVaultCollateral(collateralType);

        // Mint stablecoins to the sender
        AssociatedSystem.load(_USD_TOKEN).asToken().mint(msg.sender, amount);

        if (feeAmount > 0 && feeAddress != address(0)) {
            AssociatedSystem.load(_USD_TOKEN).asToken().mint(feeAddress, feeAmount);

            emit IssuanceFeePaid(accountId, poolId, collateralType, feeAmount);
        }

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
        FeatureFlag.ensureAccessToFeature(_BURN_FEATURE_FLAG);
        Pool.Data storage pool = Pool.load(poolId);

        // Retrieve current position debt
        int256 debt = pool.updateAccountDebt(collateralType, accountId);

        // Ensure the position can't burn if it already has no debt
        if (debt <= 0) {
            revert InsufficientDebt(debt);
        }

        uint256 feePercent = Config.readUint(_CONFIG_BURN_FEE_RATIO, 0);
        uint256 feeAmount = amount - amount.divDecimal(DecimalMath.UNIT + feePercent);
        address feeAddress = feeAmount > 0
            ? Config.readAddress(_CONFIG_BURN_FEE_ADDRESS, address(0))
            : address(0);

        // Only allow burning the total debt of the position
        if (amount.toInt() > debt + debt.mulDecimal(feePercent.toInt())) {
            feeAmount = debt.toUint().mulDecimal(feePercent);
            amount = debt.toUint() + feeAmount;
        }

        // Burn the stablecoins
        AssociatedSystem.load(_USD_TOKEN).asToken().burn(msg.sender, amount);

        if (feeAmount > 0 && feeAddress != address(0)) {
            AssociatedSystem.load(_USD_TOKEN).asToken().mint(feeAddress, feeAmount);

            emit IssuanceFeePaid(accountId, poolId, collateralType, feeAmount);
        }

        VaultEpoch.Data storage epoch = Pool.load(poolId).vaults[collateralType].currentEpoch();

        // Decrease the debt of the position
        epoch.assignDebtToAccount(accountId, -(amount - feeAmount).toInt());

        // Increase the credit available in the vault
        pool.recalculateVaultCollateral(collateralType);

        emit UsdBurned(accountId, poolId, collateralType, amount, msg.sender);
    }
}
