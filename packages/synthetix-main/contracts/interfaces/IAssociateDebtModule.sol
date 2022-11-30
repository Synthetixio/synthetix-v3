//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";

/// @title Module to allow for the migration of debt from another system to Synthetix
interface IAssociateDebtModule {
    /**
     * @notice Emitted when `associateDebt` is called.
     */
    event DebtAssociated(
        uint128 indexed marketId,
        uint128 indexed poolId,
        address indexed collateralType,
        uint128 accountId,
        uint amount,
        int updatedDebt
    );

    /**
     * @dev Allows for a market, at its discression to allocate the assignment of recently accumulated debt in a
     * market toward an individual
     */
    function associateDebt(
        uint128 marketId,
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint amount
    ) external returns (int);
}
