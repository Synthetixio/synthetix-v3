//SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./IBasePerpMarket.sol";

interface IMarginModule is IBasePerpMarket {
    // --- Structs --- //

    struct ConfiguredCollateral {
        // Id of the synth market.
        uint128 synthMarketId;
        // The underlying spot market synth sell oracle node id.
        bytes32 oracleNodeId;
        // Maximum allowable deposited amount.
        uint128 maxAllowable;
        // Address of the associated reward distributor.
        address rewardDistributor;
    }

    // --- Events --- //

    // @notice Emitted when margin is deposited from user to market.
    event MarginDeposit(address indexed from, address indexed to, uint256 value, uint128 synthMarketId);

    // @notice Emitted when margin is withdrawn from market to user.
    event MarginWithdraw(address indexed from, address indexed to, uint256 value, uint128 synthMarketId);

    // @notice Emitted when collateral is configured.
    event CollateralConfigured(address indexed from, uint256 collaterals);

    // --- Mutative --- //

    /**
     * @notice Convenience method to withdraw all collateral for `accountId` and `marketId`.
     *
     * This method will revert if the account has an open positions or orders. There are no fees associated with the
     * withdrawal of collateral.
     */
    function withdrawAllCollateral(uint128 accountId, uint128 marketId) external;

    /**
     * @notice Transfers an accepted `synthMarketId` as margin from sender to `accountId` on a specific `marketId`.
     *
     * A negative `amountDelta` is a withdrawal. A variety of errors are thrown if limits or collateral
     * issues are found. A transfer, even when there is no open position will immediately deposit the
     * collateral into the Synthetix core system.
     *
     * There are no fees associated with the transfer of collateral.
     */
    function modifyCollateral(uint128 accountId, uint128 marketId, uint128 synthMarketId, int256 amountDelta) external;

    /**
     * @notice Configure with collateral types (synth ids) and their max allowables (deposits).
     *
     * The order in which `synthMarketIds` is defined is also used as the deduction priority. It is recommended to use
     * sUSD as the first `synthMarketId` so that negative PnL/fees are deducted from sUSD before other collateral types.
     */
    function setCollateralConfiguration(
        uint128[] calldata synthMarketIds,
        bytes32[] calldata oracleNodeIds,
        uint128[] calldata maxAllowables,
        address[] calldata rewardDistributors
    ) external;

    /**
     * @notice Set max allowables for existing collateral
     */
    function setCollateralMaxAllowable(uint128 synthMarketId, uint128 maxAllowable) external;

    // --- Views --- //

    /**
     * @notice Returns the configured collaterals used as margin.
     */
    function getConfiguredCollaterals() external view returns (ConfiguredCollateral[] memory);

    /**
     * @notice Returns the total value of deposited collaterals in USD for `accountId` and `marketId`.
     */
    function getCollateralUsd(uint128 accountId, uint128 marketId) external view returns (uint256);

    /**
     * @notice Returns the total value of deposited collaterals -fees and +PnL in USD.
     */
    function getMarginUsd(uint128 accountId, uint128 marketId) external view returns (uint256);
}
