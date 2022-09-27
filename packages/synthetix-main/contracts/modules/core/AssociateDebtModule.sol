//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IAssociateDebtModule.sol";
import "../../storage/LiquidationModuleStorage.sol";

import "../../mixins/CollateralMixin.sol";
import "../../mixins/PoolMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";

import "../../utils/ERC20Helper.sol";
import "../../utils/SharesLibrary.sol";

contract AssignDebtModule is
    IAssociateDebtModule,
    LiquidationModuleStorage,
    AssociatedSystemsMixin,
    CollateralMixin,
    PoolMixin,
    AccountRBACMixin
{
    using MathUtil for uint;
    using ERC20Helper for address;
    using SharesLibrary for SharesLibrary.Distribution;

    bytes32 private constant _USD_TOKEN = "USDToken";

    error Unauthorized(address actual);

    function associateDebt(uint marketId, uint poolId, address collateralType, uint accountId, uint amount) external returns (int) {

        // load up the vault
        VaultData storage vaultData = _poolVaultStore().poolVaults[poolId][collateralType];
        VaultEpochData storage epochData = vaultData.epochData[vaultData.epoch];

        MarketData storage marketData = _marketManagerStore().markets[marketId];

        // market must match up
        if (msg.sender != marketData.marketAddress) {
            revert Unauthorized(msg.sender);
        }

        // verify the requested account actually has collateral to cover the new debt
        bytes32 actorId = bytes32(accountId);
        epochData.collateralDist.getActorValue(actorId);

        // subtract the requested amount of debt from the market
        // this debt should have been accumulated just now anyway so 
        marketData.issuance -= int128(int(amount));

        // register account debt
        _updatePositionDebt(accountId, poolId, collateralType);

        // increase account debt
        int updatedDebt = epochData.usdDebtDist.getActorValue(actorId) + int(amount);

        // verify the c ratio
        // TODO
        //if ()

        epochData.usdDebtDist.updateActorValue(actorId, updatedDebt);

        // done
        return updatedDebt;
    }
}
