//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

/**
 * @title Account events used on several places in the system.
 */
interface IAccountEvents {
    /**
     * @notice Gets fired anytime an account is charged with fees, paying settlement rewards.
     * @param accountId Id of the account being deducted.
     * @param amount Amount of synth market deducted from the account.
     * @param accountDebt current debt of the account after charged amount.
     */
    event AccountCharged(uint128 accountId, int256 amount, uint256 accountDebt);
}
