//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IPolicyModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "../storage/InsuredMarket.sol";

// solhint-disable-next-line no-empty-blocks
abstract contract BaseAdapterPolicyModule is IPolicyModule {

    using AssociatedSystem for AssociatedSystem.Data;
    using InsuredMarket for InsuredMarket.Data;

    using SafeCastU256 for uint256;

    bytes32 constant private _ASSOCIATED_SYSTEM_POLICY_NFT = "policyNft";

    function openPolicy(
        address beneficiary,
        uint128 maxUsd,
        uint64 period,
        uint maxCost
    ) external returns (uint128 policyId, uint policyCost) {

        InsuredMarket.Data storage insuredMarket = InsuredMarket.load();

        // create new nft
        policyId = ++insuredMarket.lastPolicyId;
        AssociatedSystem.load(_ASSOCIATED_SYSTEM_POLICY_NFT).asNft().mint(beneficiary, policyId);

        // create policy
        Policy.Data memory newPolicy = Policy.Data(policyId, maxUsd, uint64(block.timestamp) + period);
        Policy.Data storage policy = Policy.create(newPolicy);

        // collect premium
        // normally premium would be collected at the very beginning but we have to have the actual policy
        // ready to go before we can charge for it
        policyCost = insuredMarket.computePolicyFee(newPolicy);

        if (policyCost > maxCost) {
            revert PolicyTooExpensive(policyCost, maxCost);
        }

        insuredMarket.synthetixCore.depositMarketUsd(insuredMarket.myMarketId, msg.sender, policyCost);

        // write to insured market (also validates policy meets insured market settings)
        insuredMarket.addPolicy(policy);

        emit PolicyOpened(beneficiary, policyId, policy);
    }

    function claim(
        uint128 policyId,
        uint minUsdClaimAmount
    ) external {
        Policy.Data storage policy = Policy.load(policyId);

        INftModule nftSystem = AssociatedSystem.load(_ASSOCIATED_SYSTEM_POLICY_NFT).asNft();

        address beneficiary = nftSystem.ownerOf(policy.beneficiary);

        // burn policy token
        nftSystem.burn(policy.beneficiary);

        // collect market assets and verify >= claimAmount
        uint policyCoverageAmount = policy.maxAmount;
        InsuredMarket.Data storage insuredMarket = InsuredMarket.load();
        uint assumedUsdAmount = _assumePosition(insuredMarket, beneficiary, policyCoverageAmount);

        if (minUsdClaimAmount < assumedUsdAmount) {
            revert ClaimInsufficient(assumedUsdAmount, minUsdClaimAmount);
        }

        // issue claimed amount
        insuredMarket.synthetixCore.withdrawMarketUsd(insuredMarket.myMarketId, beneficiary, assumedUsdAmount);

        // policy is now over
        insuredMarket.clearPolicy(policyId);

        emit Claimed(policyId, beneficiary, assumedUsdAmount);
    }

    function expirePolicies(
        uint maxExpire
    ) external returns (uint numCleared, uint amountFreed) {
        return InsuredMarket.load().clearExpiredPolicies(maxExpire);
    }

    function _calculateAccountValue(InsuredMarket.Data storage insuredMarket, address from) internal virtual returns (uint);
    function _assumePosition(InsuredMarket.Data storage insuredMarket, address from, uint amount) internal virtual returns (uint);
    function _sellPosition(InsuredMarket.Data storage insuredMarket, uint amount) internal virtual returns (uint);
}
