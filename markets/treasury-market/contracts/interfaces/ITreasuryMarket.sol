//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./external/IV3CoreProxy.sol";

/**
 * @title Synthetix V3 Market allowing for a trusted entity to manage excess liquidity allocated to a liquidity pool.
 */
interface ITreasuryMarket {
    struct DepositRewardAmounts {
        uint128 percent;
        uint128 maxCollateral;
    }

    struct DepositRewardConfiguration {
        address token;
        uint32 power;
        uint32 duration;
        bytes32 valueRatioOracle;
        uint128 penaltyStart;
        uint128 penaltyEnd;
        DepositRewardAmounts[] amounts;
    }

    struct LoanInfo {
        uint64 startTime;
        uint32 power;
        uint32 duration;
        uint128 loanAmount;
    }

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
     * @notice Emitted if an account was migrated but its c-ratio was insufficient for assigning debt in v3
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
     * @notice Emitted when a user received a reward for depositing and saddling into the treasury market
     */
    event DepositRewardIssued(
        uint128 indexed accountId,
        address indexed rewardToken,
        LoanInfo depositedRewardData
    );

    /**
     *
     */
    event DepositRewardRedeemed(
        uint128 indexed accountId,
        address indexed rewardToken,
        uint256 rewardRedeemed,
        uint256 penaltyPaid
    );

    /**
     * @notice Emitted after a call to `treasuryMint`, where the owner has pulled funds from the market into the configured treasury address
     */
    event TreasuryMinted(uint256 amount);

    /**
     * @notice Emitted after a call to `setDebtDecayFunction`, where the settings for new and existing issued loans may be modified by the owner.
     */
    event DebtDecayUpdated(uint32 power, uint32 duration, uint128 startPenalty, uint128 endPenalty);

    // copied from v3 core system for event recognition purposes
    event MarketRegistered(
        address indexed market,
        uint128 indexed marketId,
        address indexed sender
    );

    /**
     * @notice
     */
    event TreasuryBurned(uint256 amount);

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
     * @notice Emitted when there is not enough clearable debt to allow the user that is unsaddling to exit
     */
    error InsufficientExcessDebt(int256 neededToRepay, int256 ableToRepay);

    /**
     * @notice Emitted when there is not enough deposited reward funds to cover the user's deposit in the contract
     */
    error InsufficientAvailableReward(
        address rewardToken,
        uint256 rewardedAmount,
        uint256 availableToReward
    );

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
     * @dev Prior to calling this function, the account must have approved for transfer of the ERC721 account token to this address so that this market can repay the debt.
     */
    function adjustLoan(uint128 accountId, uint256 amount) external;

    /**
     * @dev Used by the treasury to deposit a token to be used for a rewards configuration. The deposited tokens can also be minted from
     */
    function fundForDepositReward(address token, uint256 amount) external returns (uint256);

    /**
     * @dev Used by the treasury to remove a token from a deposit rewards configuration.
     */
    function removeFromDepositReward(address token, uint256 amount) external returns (uint256);

    /**
     * @notice Called by the owner to mint available sUSD to the treasury.
     */
    function mintTreasury(uint256 amount) external;

    /**
     * @notice Called by the owner to burn sUSD into the market from the configured treasury
     * @dev Before calling this function, ensure that the treasury has `approve`d transfer of at least `amount` sUSD to this address.
     */
    function burnTreasury(uint256 amount) external;

    /**
     * @notice Adjust the market's reported debt such that the c-ratio of the vault matches that of the configured targetCRatio, if possible
     * @dev this function's implementation is automtaically called by other functions, such as `unsaddle`, `mintTreasury`, `burnTreasury`
     */
    function rebalance() external;

    /**
     * @notice Called by owner to change the c-ratio which will be rebalanced to for the vault.
     */
    function setTargetCRatio(uint256 ratio) external;

    /**
     * @notice Retrieves the current amount of loan remaining for the given accountId
     * @param accountId The account to retrieve current debt for
     */
    function loanedAmount(uint128 accountId) external view returns (uint256);

    /**
     * @notice Retrieves the current amount of reward that the user would keep if they chose to withdraw immediately (not accounting for penalty)
     * @param accountId The account to retrieve current debt for
     */
    function depositRewardAvailable(
        uint128 accountId,
        address rewardTokenAddress
    ) external view returns (uint256);

    /**
     * @notice Returns the amount of penalty which must be repaid upon early repayment. This amount is on top of the amount of the principal repaid.
     * @param accountId The account for which the repayment penalty is being calculated.
     * @param targetDebt The target amount of debt to calculate the repayment penalty for.
     * @return The calculated penalty amount.
     */
    function repaymentPenalty(
        uint128 accountId,
        uint256 targetDebt
    ) external view returns (uint256);

    /**
     * @notice Calculates the penalty amount for early withdrawal. This penalty is added on top of the accrued rewards amount.
     * @param accountId The account for which the deposit reward penalty is being calculated.
     * @param depositRewardToken The token in which the deposit reward is denominated.
     * @return The calculated penalty amount that is applied on top of accrued rewards.
     */
    function depositRewardPenalty(
        uint128 accountId,
        address depositRewardToken
    ) external view returns (uint256);

    /**
     * @notice Called by the owner to change the parameters for new loans, and to modify the penalty payment in the case of early withdrawal during
     * repayment plan
     * @param power the curve of the debt repayment. for example, `1` is linear, `2` is quadratic, `3` is cubic, and etc. Only whole numbers supported. Up to 100
     * @param time The number of seconds a loan should be active for. After `time` seconds have passed, the loan is fully repaid.
     * @param startPenalty The percentage of paid debt which is returned on penalty upon early repayment. Applies at loan repayment time t=0 This value is linearly combined with the `endPenalty` to adjust teh resulting repayment amount.
     * @param endPenalty The percentage of paid debt which is returned on penalty upon early repayment. Applies at loan repayment time t=time (the lengt hof the loan). Once the end of the loan has been reached, there is no penalty to be paid because the loan has been fully erased.
     */
    function setDebtDecayFunction(
        uint32 power,
        uint32 time,
        uint128 startPenalty,
        uint128 endPenalty
    ) external;

    /**
     * @notice Called by the owner to set rewards distributed to new saddlers. Completely replaces any existing reward configurations already set
     * @param newDrcs The reward configurations that should be set
     */
    function setDepositRewardConfigurations(DepositRewardConfiguration[] memory newDrcs) external;
}
