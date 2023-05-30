//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../../interfaces/IAssociateDebtModule.sol";

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

import "../../storage/Account.sol";
import "../../storage/Pool.sol";

/**
 * @title Module for associating debt with the system.
 * @dev See IAssociateDebtModule.
 */
contract AssociateDebtModule is IAssociateDebtModule {
    using DecimalMath for uint256;
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using ERC20Helper for address;
    using Distribution for Distribution.Data;
    using Pool for Pool.Data;
    using Vault for Vault.Data;
    using VaultEpoch for VaultEpoch.Data;
    using CollateralConfiguration for CollateralConfiguration.Data;
    using ScalableMapping for ScalableMapping.Data;

    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _ASSOCIATE_DEBT_FEATURE_FLAG = "associateDebt";

    /**
     * @inheritdoc IAssociateDebtModule
     */
    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint256 amount
    ) external returns (int256) {
        FeatureFlag.ensureAccessToFeature(_ASSOCIATE_DEBT_FEATURE_FLAG);
        Account.exists(accountId);

        Pool.Data storage poolData = Pool.load(poolId);
        VaultEpoch.Data storage epochData = poolData.vaults[collateralType].currentEpoch();
        Market.Data storage marketData = Market.load(marketId);

        if (msg.sender != marketData.marketAddress) {
            revert AccessError.Unauthorized(msg.sender);
        }

        // The market must appear in pool configuration of the specified position
        if (!poolData.hasMarket(marketId)) {
            revert NotFundedByPool(marketId, poolId);
        }

        // Refresh latest account debt
        poolData.updateAccountDebt(collateralType, accountId);

        // rebalance here because this is a good opporitunity to do so, and because its required for correct debt accounting after account debt update
        poolData.rebalanceMarketsInPool();

        // Remove the debt we're about to assign to a specific position, pro-rata
        epochData.distributeDebtToAccounts(-amount.toInt());

        // Assign this debt to the specified position
        int256 updatedDebt = epochData.assignDebtToAccount(accountId, amount.toInt());

        (, uint256 actorCollateralValue) = poolData.currentAccountCollateral(
            collateralType,
            accountId
        );

        // Reverts if this debt increase would make the position liquidatable
        _verifyCollateralRatio(
            collateralType,
            updatedDebt > 0 ? updatedDebt.toUint() : 0,
            actorCollateralValue
        );

        emit DebtAssociated(marketId, poolId, collateralType, accountId, amount, updatedDebt);

        return updatedDebt;
    }

    /**
     * @dev Reverts if a collateral ratio would be liquidatable.
     */
    function _verifyCollateralRatio(
        address collateralType,
        uint256 debt,
        uint256 collateralValue
    ) internal view {
        uint256 liquidationRatio = CollateralConfiguration.load(collateralType).liquidationRatioD18;
        if (debt != 0 && collateralValue.divDecimal(debt) < liquidationRatio) {
            revert InsufficientCollateralRatio(
                collateralValue,
                debt,
                collateralValue.divDecimal(debt),
                liquidationRatio
            );
        }
    }
}
