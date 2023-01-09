//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Module for synth wrappers
 */
interface IWrapperModule {
    /**
     * @notice Thrown when trader specified amounts to wrap/unwrap without holding the underlying asset.
     */
    error InsufficientFunds();
    /**
     * @notice Thrown when trader has not provided allowance for the market to transfer the underlying asset.
     */
    error InsufficientAllowance(uint expected, uint current);

    /**
     * @notice Gets fired after wrapper is initialized for the market.
     * @param synthMarketId Id of the market the wrapper is initialized for.
     * @param collateralType the collateral used to wrap the synth.
     */
    event WrapperInitialized(uint indexed synthMarketId, address collateralType);

    /**
     * @notice Gets fired after user wraps synth
     * @param synthMarketId Id of the market.
     * @param amountWrapped amount of synth wrapped.
     * @param totalFees total fees applied on the transaction.
     * @param feesCollected fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
     */
    event SynthWrapped(
        uint indexed synthMarketId,
        uint amountWrapped,
        int totalFees,
        uint feesCollected
    );

    /**
     * @notice Gets fired after user unwraps synth
     * @param synthMarketId Id of the market.
     * @param amountUnwrapped amount of synth unwrapped.
     * @param totalFees total fees applied on the transaction.
     * @param feesCollected fees collected by the configured FeeCollector for the market (rest of the fees are deposited to market manager).
     */
    event SynthUnwrapped(
        uint indexed synthMarketId,
        uint amountUnwrapped,
        int totalFees,
        uint feesCollected
    );

    /**
     * @notice Initializes wrapper functionality for the specified market with the specified collateral type.
     * @dev Initializing wrapper enables traders to wrap and unwrap synths with the specified collateral type.
     * @dev The collateral type has to be a supported collateral type in the synthetix v3 core system, otherwise this transaction fails.
     * @param marketId Id of the market to enable wrapping for.
     * @param collateralType The collateral being used to wrap the synth.
     */
    function initializeWrapper(uint128 marketId, address collateralType) external;

    /**
     * @notice Wraps the specified amount and returns similar value of synth minus the fees.
     * @dev Fees are collected from the user by way of the contract returning less synth than specified amount of collateral.
     * @param marketId Id of the market used for the trade.
     * @param wrapAmount Amount of collateral to wrap.  This amount gets deposited into the market collateral manager.
     * @return amountReturned Amount of synth returned to user.
     */
    function wrap(uint128 marketId, uint wrapAmount) external returns (uint);

    /**
     * @notice Unwraps the synth and returns similar value of collateral minus the fees.
     * @dev Transfers the specified synth, collects fees through configured fee collector, returns collateral minus fees to trader.
     * @param marketId Id of the market used for the trade.
     * @param unwrapAmount Amount of synth trader is unwrapping.
     * @return amountReturned Amount of collateral returned.
     */
    function unwrap(uint128 marketId, uint unwrapAmount) external returns (uint);
}
