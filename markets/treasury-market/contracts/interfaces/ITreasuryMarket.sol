//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/IV3CoreProxy.sol";

/**
 * @title Synthetix V3 Market allowing for a trusted entity to manage excess liquidity allocated to a liquidity pool.
 */
interface ITreasuryMarket {
    function v3System() external view returns (IV3CoreProxy);

    /**
     * @notice Emitted when a new target cratio has been set
     */
    event TargetCRatioSet(uint256 newCRatio);

    /**
     * @notice Emitted after an account has been registered into the treasury
     */
    event AccountSaddled(uint128 indexed accountId, uint256 collateralAmount, uint256 debtAssigned);

    /**
     * @notice Emitted when the artificial debt of the vault is modified to match the current c-ratio
     */
    event Rebalanced(int256 previousVaultDebt, int256 newVaultDebt);

    /**
     * @notice Emitted if an account was migrated but its c-ratioi was insufficient for assigning debt in v3
     */
    event AccountUnsaddled(
        uint128 indexed accountId,
        uint256 collateralAmount,
        uint256 debtUnassigned
    );

    /**
     * @notice Emitted when a user's registered loan amount (which they must repay in full to withdraw their staked tokens) has been modified
     */
    event LoanAdjusted(
        uint128 indexed accountId,
        uint256 newLoanedAmount,
        uint256 previousLoanedAmount
    );

    /**
     * @notice Emitted after a call to `treasuryMint`, where the owner has pulled funds from the market into the configured treasury address
     */
    event TreasuryMinted(uint256 amount);

    /**
     * @notice Emitted after a call to `treasuryBurn`, where the owner has pushed funds from the treasury into the market
     */
    event TreasuryBurned(uint256 amount);

    // copied from v3 core system for event recognition purposes
    event MarketRegistered(
        address indexed market,
        uint128 indexed marketId,
        address indexed sender
    );

    /**
     * @notice Emitted when `registerMarket` is called, but the market has already been registered.
     */
    error MarketAlreadyRegistered(uint128 marketId);

    /**
     * @notice Emitted when a user is unable to continue because their cratio is below the minimum required to fund the treasury
     */
    error InsufficientCRatio(uint128 accountId, uint256 currentDebt, uint256 targetDebt);

    /**
     * @notice Emitted when the current operation cannot be completed because a loan is taken out on the account, and must be repaid in full
     */
    error OutstandingLoan(uint128 accountId, uint256 outstandingLoanAmount);

    /**
     * @notice called by the owner to register this market with v3. This is an initialization call only.
     */
    function registerMarket() external returns (uint128 newMarketId);

    /**
     * @notice Called by any address to indicate that a user has increased their delegation in a pool and needs to have debt applied to their account
     * @dev Unlike `unsaddle`, this function does not take ownership of the account token. This is because there is more than one way in which
     * a user may become part of the pool (while there is only really one way in which a user may want to exit)
     */
    function saddle(uint128 accountId) external;

    /**
     * @dev Prior to calling this function, the account must have approved for transfer of the ERC721 account token to this address so that this market can repay the debt.
     */
    function unsaddle(uint128 accountId) external;

    /**
     * @notice Called by the owner to mint available sUSD to the treasury.
     */
    function mintTreasury(uint256 amount) external;

    /**
     * @notice Called by the owner to burn sUSD into the market from the configured treasury
     * @dev Before calling this function, ensure that the treasury has `approve`d transfer of at least `amount` sUSD to this address.
     */
    function burnTreasury(uint256 amount) external;
}
