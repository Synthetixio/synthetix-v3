//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/HeapUtil.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "@synthetixio/main/contracts/interfaces/external/IMarket.sol";

import "./Policy.sol";

import "./InsuranceSettings.sol";

/**
 * @title Top level storage for a market which can be insured
 */
library InsuredMarket {
    using HeapUtil for HeapUtil.Data;

    using SafeCastI128 for int128;
    using SafeCastU128 for uint128;

    /**
     * @notice Thrown when the user tries to open a policy that doesn't meet the term requirements
     * @param requestedTerm the policy term requested by the user
     * @param minTerm the minimum number of seconds a policy can be active for
     * @param maxTerm the maximum number of seconds a policy can be active for
     */
    error PolicyTermInvalid(uint requestedTerm, uint minTerm, uint maxTerm);

    struct Data {
        InsuranceSettings.Data settings;

        IMarketManagerModule synthetixCore;
        IMarket targetMarket;

        uint128 myMarketId;
        uint128 lastPolicyId;

        // total amount owed if all policies were to become due. This amount is locked in the market
        uint128 totalOpenValue;
        
        // used to pop expired policies so that totalOpenValue can be reduced.
        HeapUtil.Data policiesByExpiry;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.insurance-market.InsuredMarket"));
        assembly {
            store.slot := s
        }
    }

    function computePolicyFee(Data storage self, Policy.Data memory newPolicy) internal view returns (uint) {
        // TODO: add pricing exponent
        // TODO: add modifier for collateral price
        return newPolicy.maxAmount * 
            (
                (self.totalOpenValue * 2 + newPolicy.maxAmount) / 
                (2 * self.synthetixCore.getMarketCollateral(self.myMarketId))
            );
    }

    function addPolicy(Data storage self, Policy.Data storage newPolicy) internal {

        // does the policy meet the insured market requirements
        uint period = newPolicy.expiresAt - block.timestamp;

        if (period < self.settings.minPolicyTime ||
            period > self.settings.maxPolicyTime) {
            
            revert PolicyTermInvalid(period, self.settings.minPolicyTime, self.settings.maxPolicyTime);
        }

        self.totalOpenValue += newPolicy.maxAmount;
        self.policiesByExpiry.insert(newPolicy.beneficiary, -uint128(newPolicy.expiresAt).toInt());
    }

    function clearPolicy(Data storage self, Policy.Data storage clearedPolicy) internal {
        self.totalOpenValue -= clearedPolicy.maxAmount;
        self.policiesByExpiry.extractById(clearedPolicy.beneficiary);
    }

    function clearExpiredPolicies(Data storage self, uint maxExpire) internal returns (uint numChecked, uint amountFreed) {
        uint timeNow = block.timestamp;
        for (numChecked = 0;numChecked < maxExpire;numChecked++) {
            HeapUtil.Node memory nextExpiringPolicy = self.policiesByExpiry.getMax();
            if (timeNow >= (-nextExpiringPolicy.priority).toUint()) {
                Policy.Data storage policy = Policy.load(nextExpiringPolicy.id);
                clearPolicy(self, policy);
                amountFreed += policy.maxAmount;
            } else {
                break;
            }
        }
    }
}
