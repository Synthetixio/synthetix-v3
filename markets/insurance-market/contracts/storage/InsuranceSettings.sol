//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";

import "./Policy.sol";

/**
 * @title Top level storage for a market which can be insured
 */
library InsuranceSettings {
    using HeapUtil for HeapUtil.Data;

    struct Data {
        // id of the market which is insured
        uint128 insuredMarketId;

        // the price to open a policy is determined by ((issuedBefore + issuedAfter) / 2 / marketCollateralValue) ** exponent. 
        // Exponent > 1 will make policies artificially cheaper for longer even if a lot are opened.
        // Exponent < 1 will make policies artificially expensive
        // policies always cost the same as or greater than the amount insured once the marketCollateralValue is reached, so there will be no 
        // incentive to open at that point
        uint128 pricingExponent;

        uint64 minPolicyTime;
        uint64 minPolicyTimeDiscount;
        uint64 maxPolicyTime;
        uint64 maxPolicyTimePremium;

        uint128 generalPolicyTime;
    }
}