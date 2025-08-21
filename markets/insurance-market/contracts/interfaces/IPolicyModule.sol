//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "../storage/Policy.sol";

/**
 * @title Module for spot market factory
 */
interface IPolicyModule {
    /**
     * @notice Thrown when the policy cost exceeds the max amount set by the user
     * @param policyCost the cost of the requested policy
     * @param maxAmount the amount which the user specified shouldn't be exceeded
     */
    error PolicyTooExpensive(uint policyCost, uint maxAmount);

    /**
     * @notice Thrown when the user requests a minimum claim amount for redemption of their insolvent assets, but the amount is less than 
     * @param assumedUsdAmount total potentially solvent USD value of assets assumed by the insurance market and to send to the user
     * @param minUsdClaimAmount the user specified minimum claim USD amount
     */
    error ClaimInsufficient(uint assumedUsdAmount, uint minUsdClaimAmount);

    /**
     * @notice Emitted when market nominee renounces nomination.
     * @param beneficiary the address which can claim the policy
     * @param policyId the ID of the created policy
     * @param policy the full policy data
     */
    event PolicyOpened(address indexed beneficiary, uint128 indexed policyId, Policy.Data policy);

    /**
     * @notice Emitted when policy is claimed by beneficiary. Contract takes on value of illiquid assets, and beneficiary receives freshly minted market USD in return. The policy becomes invalid.
     * @param policyId the ID of the now closed policy which was claimed
     * @param beneficiary the address which claimed the policy
     * @param amountClaimed the USD claimed by the beneficiary (may be less than policy maxAmount if their insolvent market assets are less than that amount)
     */
    event Claimed(uint128 indexed policyId, address indexed beneficiary, uint amountClaimed);

    /**
     * @notice Allows for a participant in the insured market to apply for insurance
     */
    function openPolicy(
        address beneficiary,
        uint128 maxUsd,
        uint64 period,
        uint maxCost
    ) external returns (uint128 policyId, uint policyCost);

    /**
     * @notice After insurance policies expired, they need to be cleared from policy storage.
     * This function can be invoked by a bot or interested party to clear up to maxExpire expired policies.
     */
    function expirePolicies(
        uint maxExpire
    ) external returns (uint numCleared, uint amountFreed);
}
