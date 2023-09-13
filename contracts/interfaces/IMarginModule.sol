//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IBasePerpMarket.sol";

interface IMarginModule is IBasePerpMarket {
    // --- Structs --- //

    struct AvailableCollateral {
        // Id of the synth market.
        uint128 synthMarketId;
        // Maximum allowable deposited amount.
        uint128 maxAllowable;
    }

    // --- Events --- //

    // @dev Emitted when margin is deposited from user to market.
    event MarginDeposit(address indexed from, address indexed to, uint256 value, uint128 synthMarketId);

    // @dev Emitted when margin is withdrawn from market to user.
    event MarginWithdraw(address indexed from, address indexed to, uint256 value, uint128 synthMarketId);

    // @dev Emitted when collateral is configured.
    event CollateralConfigured(address indexed from, uint256 collaterals);

    // --- Mutative --- //

    /**
     * @dev Convenience method to withdraw all collateral for an account and market.
     *
     * This method will revert if the account has an open positions or orders. There are no fees associated with the
     * withdrawal of collateral.
     */
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external;

    /**
     * @dev Transfers an accepted `collateral` as margin from sender to `accountId` on a specific `marketId`.
     *
     * A negative `amountDelta` is a withdrawal. A variety of errors are thrown if limits or collateral
     * issues are found. A transfer, even when there is no open position will immediately deposit the
     * collateral into the Synthetix core system.
     *
     * There are no fees associated with the transfer of collateral.
     */
    function modifyCollateral(uint128 accountId, uint128 marketId, uint128 synthMarketId, int256 amountDelta) external;

    /**
     * @dev Configure with collateral types (synth id) and their allowables.
     *
     * Recommended to use sUSD as the first collateralType so that negative PnL deducts from sUSD before other
     * collateral types to facilitate better UX.
     */
    function setCollateralConfiguration(uint128[] calldata synthMarketIds, uint128[] calldata maxAllowables) external;

    // --- Views --- //

    /**
     * @dev Returns the configured collaterals used as margin.
     */
    function getConfiguredCollaterals() external view returns (AvailableCollateral[] memory);

    /**
     * @dev Returns the total value of deposited collaterals in USD.
     */
    function getCollateralUsd(uint128 accountId, uint128 marketId) external view returns (uint256);

    /**
     * @dev Returns the total value of deposited collaterals, minus fees and + pnl in USD.
     */
    function getMarginUsd(uint128 accountId, uint128 marketId) external view returns (uint256);
}
