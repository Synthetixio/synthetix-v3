//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./IBasePerpMarket.sol";

interface IMarginModule is IBasePerpMarket {
    // --- Structs --- //

    struct AvailableCollateral {
        // Address of the available collateral.
        address collateralType;
        // Oracle price feed node id.
        bytes32 oracleNodeId;
        // Maximum allowable deposited amount.
        uint128 maxAllowable;
    }

    // --- Events --- //

    // @dev Emitted when collateral is deposited from user to market.
    event MarginDeposit(address indexed from, address indexed to, uint256 value);

    // @dev Emitted when collateral is withdrawn from market to user.
    event MarginWithdraw(address indexed from, address indexed to, uint256 value);

    // @dev Emitted when collateral is configured.
    event CollateralConfigured(address indexed from, uint256 collaterals);

    // --- Mutative --- //

    /**
     * @dev Transfers an accepted `collateral` as margin from msg.sender to `accountId` on a specific `marketId`.
     *
     * A negative `amountDelta` is a withdrawal. A variety of errors are thrown if limits or collateral
     * issues are found. A transfer, even when there is no open position will immediately deposit the
     * collateral into the Synthetix core system.
     *
     * There are no fees associated with the transfer of collateral.
     */
    function modifyCollateral(uint128 accountId, uint128 marketId, address collateral, int256 amountDelta) external;

    /**
     * @dev Configure Margin with collateral types and their allowables.
     *
     * Recommended to use sUSD as the first collateralType so that negative PnL deducts from sUSD before other
     * collateral types to facilitate better UX.
     */
    function setCollateralConfiguration(
        address[] calldata collateralTypes,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables
    ) external;

    // --- Views --- //

    /**
     * @dev Returns the configured collaterals used as margin.
     */
    function getConfiguredCollaterals() external view returns (AvailableCollateral[] memory collaterals);

    /**
     * @dev Returns the total value of deposited collaterals in USD.
     */
    function getNotionalValueUsd(uint128 accountId, uint128 marketId) external view returns (uint256);
}
