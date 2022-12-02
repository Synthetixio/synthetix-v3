//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IAssociateDebtModule.sol";

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Helper.sol";

import "../../storage/Distribution.sol";
import "../../storage/Pool.sol";
import "../../storage/Market.sol";

contract AssociateDebtModule is IAssociateDebtModule {
    using DecimalMath for uint;

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

    error Unauthorized(address actual);
    error NotFundedByPool(uint marketId, uint poolId);
    error InsufficientCollateralRatio(uint collateralValue, uint debt, uint ratio, uint minRatio);

    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint amount
    ) external returns (int) {
        // load up the vault
        Pool.Data storage poolData = Pool.load(poolId);
        VaultEpoch.Data storage epochData = poolData.vaults[collateralType].currentEpoch();

        Market.Data storage marketData = Market.load(marketId);

        // market must match up
        if (msg.sender != marketData.marketAddress) {
            revert Unauthorized(msg.sender);
        }

        // market must appear in pool configuration
        if (!poolData.hasMarket(marketId)) {
            revert NotFundedByPool(marketId, poolId);
        }

        // verify the requested account actually has collateral to cover the new debt
        bytes32 actorId = bytes32(uint(accountId));

        // subtract the requested amount of debt from the market
        // this debt should have been accumulated just now anyway so
        marketData.netIssuanceD18 -= amount.toInt().to128();

        // register account debt
        poolData.updateAccountDebt(collateralType, accountId);

        // increase account debt
        int updatedDebt = epochData.assignDebtToAccount(accountId, amount.toInt());

        // verify the c ratio
        _verifyCollateralRatio(
            collateralType,
            updatedDebt > 0 ? updatedDebt.toUint() : 0,
            CollateralConfiguration.load(collateralType).getCollateralPrice().mulDecimal(
                epochData.collateralAmounts.get(actorId)
            )
        );

        emit DebtAssociated(marketId, poolId, collateralType, accountId, amount, updatedDebt);

        // done
        return updatedDebt;
    }

    function _verifyCollateralRatio(
        address collateralType,
        uint debt,
        uint collateralValue
    ) internal view {
        uint issuanceRatio = CollateralConfiguration.load(collateralType).issuanceRatioD18;

        if (debt != 0 && collateralValue.divDecimal(debt) < issuanceRatio) {
            revert InsufficientCollateralRatio(collateralValue, debt, collateralValue.divDecimal(debt), issuanceRatio);
        }
    }
}
