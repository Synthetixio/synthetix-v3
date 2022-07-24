//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../storage/CollateralStorage.sol";

/// @title Module for managing collaterals and staked collaterals per account
interface ICollateralModule {
    /// @notice SCCP Adds or Adjusts (can be enabled or re-enabled) a collateral type
    function adjustCollateralType(
        address collateralType,
        address priceFeed,
        uint targetCRatio,
        uint minimumCRatio,
        bool enabled
    ) external;

    /// @notice Gets a list of approved collateral types
    function getCollateralTypes(bool hideDisabled)
        external
        view
        returns (CollateralStorage.CollateralData[] memory collaterals);

    /// @notice Gets the information of a particular approved collateral type
    function getCollateralType(address collateralType)
        external
        view
        returns (CollateralStorage.CollateralData memory collateral);

    /// @notice Stakes collateral for an account (by the account owner or an address with 'stake' role). Transfers the collateral from the account owner.
    function stake(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    /// @notice Unstakes collateral for an account (by the account owner or an address with 'unstake' role). Transfers the collateral to the account owner
    function unstake(
        uint accountId,
        address collateralType,
        uint amount
    ) external;

    /// @notice Gets the list of collateral staked by an accountId
    function getAccountCollaterals(uint accountId) external view returns (address[] memory collateralTypes);

    /// @notice Gets stats for an account staked collateral.
    function getAccountCollateralTotals(uint accountId, address collateralType)
        external
        view
        returns (
            uint totalStaked,
            uint totalAssigned,
            uint totalLocked
        );

    /// @notice Gets the account's free collateral of collateralType that can be unstaked.
    function getAccountUnstakebleCollateral(uint accountId, address collateralType) external view returns (uint);

    /// @notice Gets the account's unassigned collateral of collateralType that can be assigned to a fund.
    function getAccountUnassignedCollateral(uint accountId, address collateralType) external view returns (uint);

    /// @notice Clean expired locks from locked collateral arrays for an account/collateral type. It includes offset and items to prevent gas exhaustion. If both, offset and items, are 0 it will traverse the whole array (unlimited)
    function cleanExpiredLocks(
        uint accountId,
        address collateralType,
        uint offset,
        uint items
    ) external;

    /// @notice Redeems the system escrow tokens into reward tokens
    function redeemReward(uint accountId, uint amount) external;
}
