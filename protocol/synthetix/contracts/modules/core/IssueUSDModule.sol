//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

import "../../interfaces/IIssueUSDModule.sol";

import "../../storage/Account.sol";
import "../../storage/Collateral.sol";
import "../../storage/CollateralConfiguration.sol";
import "../../storage/Config.sol";

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
    using Collateral for Collateral.Data;
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
     * @dev Thrown when collateral cannot be used for delegation or withdrawal because its insufficient balance in the account.
     */
    error InsufficientAvailableCollateral(
        uint256 amountAvailableForDelegationD18,
        uint256 amountD18
    );

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

        Account.Data storage account = Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._MINT_PERMISSION
        );

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

        CollateralConfiguration.Data storage config = CollateralConfiguration.load(collateralType);

        // If the resulting debt of the account is greater than zero, ensure that the resulting c-ratio is sufficient
        (, uint256 collateralValue) = pool.currentAccountCollateral(collateralType, accountId);
        config.verifyIssuanceRatio(
            newDebt,
            collateralValue,
            pool.collateralConfigurations[collateralType].issuanceRatioD18
        );

        // Increase the debt of the position
        pool.assignDebtToAccount(collateralType, accountId, amount.toInt());

        // Decrease the credit available in the vault
        pool.recalculateVaultCollateral(collateralType);

        // Confirm that the vault debt is not in liquidation
        int256 rawVaultDebt = pool.currentVaultDebt(collateralType);
        (, uint256 vaultCollateralValue) = pool.currentVaultCollateral(collateralType);
        config.verifyLiquidationRatio(rawVaultDebt, vaultCollateralValue);

        AssociatedSystem.Data storage usdToken = AssociatedSystem.load(_USD_TOKEN);

        // Mint stablecoins to the core system
        usdToken.asToken().mint(address(this), amount);

        account.collaterals[usdToken.getAddress()].increaseAvailableCollateral(amount);

        emit UsdMinted(accountId, poolId, collateralType, amount, ERC2771Context._msgSender());
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

        Account.Data storage account = Account.loadAccountAndValidatePermission(
            accountId,
            AccountRBAC._BURN_PERMISSION
        );

        Pool.Data storage pool = Pool.load(poolId);

        // Retrieve current position debt
        int256 debt = pool.updateAccountDebt(collateralType, accountId);

        // Ensure the position can't burn if it already has no debt
        if (debt <= 0) {
            revert InsufficientDebt(debt);
        }

        // Only allow burning the total debt of the position
        if (amount.toInt() > debt) {
            amount = debt.toUint();
        }

        AssociatedSystem.Data storage usdToken = AssociatedSystem.load(_USD_TOKEN);

        // Burn the stablecoins
        usdToken.asToken().burn(address(this), amount);

        account.collaterals[usdToken.getAddress()].decreaseAvailableCollateral(amount);

        // check to make sure we have not surpassed the minimum locked collateral
        // NOTE: technically we should be checking the total amount deposited (since amountAvailableForDelegation could be decremented for just having collateral in the pool)
        if (
            account.collaterals[usdToken.getAddress()].getTotalLocked() >
            account.collaterals[usdToken.getAddress()].amountAvailableForDelegationD18
        ) {
            revert InsufficientAvailableCollateral(
                account.collaterals[usdToken.getAddress()].amountAvailableForDelegationD18,
                account.collaterals[usdToken.getAddress()].getTotalLocked()
            );
        }

        // Decrease the debt of the position
        pool.assignDebtToAccount(collateralType, accountId, -amount.toInt());

        // Increase the credit available in the vault
        pool.recalculateVaultCollateral(collateralType);

        emit UsdBurned(accountId, poolId, collateralType, amount, ERC2771Context._msgSender());
    }
}
