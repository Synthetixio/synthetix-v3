//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IMarketModule.sol";

import "../storage/InsuredMarket.sol";

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";


import "@synthetixio/core-contracts/contracts/errors/InitError.sol";

// solhint-disable-next-line no-empty-blocks
contract MarketModule is IMarketModule {
    function setSettings(InsuranceSettings.Data memory settings) external override {
        OwnableStorage.onlyOwner();

        InsuredMarket.Data storage insuredMarket = InsuredMarket.load();

        if (insuredMarket.settings.insuredMarketId != 0) {
            // cant chagne the existing market id once its set because that would cause chaos
            if (settings.insuredMarketId != insuredMarket.settings.insuredMarketId) {
                revert InitError.AlreadyInitialized();
            }


        }
        else {
            insuredMarket.settings.insuredMarketId = settings.insuredMarketId;
            insuredMarket.targetMarket = IMarket(insuredMarket.synthetixCore.getMarketAddress(settings.insuredMarketId));
        }


        insuredMarket.settings.pricingExponent = settings.pricingExponent;

        insuredMarket.settings.minPolicyTime = settings.minPolicyTime;
        insuredMarket.settings.minPolicyTimeDiscount = settings.minPolicyTimeDiscount;
        insuredMarket.settings.maxPolicyTime = settings.maxPolicyTime;
        insuredMarket.settings.maxPolicyTimePremium = settings.maxPolicyTimePremium;

        insuredMarket.settings.generalPolicyTime = settings.generalPolicyTime;
    }
    
    function name(uint128 marketId) external view override returns (string memory) {
        InsuredMarket.Data storage insuredMarket = InsuredMarket.load();
        if (marketId == insuredMarket.myMarketId) {
            return string.concat(
                "Insurance: ", 
                insuredMarket.targetMarket.name(insuredMarket.settings.insuredMarketId)
            );
        }
    }

    function reportedDebt(uint128 marketId) external view override returns (uint256) {
        // market never reports any debt. instead it locks collateral (as below) and then
        // withdraws usd if needs to pay a premium, causing issuance debt
        return 0;
    }

    function locked(uint128 marketId) external view override returns (uint256) {
        InsuredMarket.Data storage insuredMarket = InsuredMarket.load();
        if (marketId == insuredMarket.myMarketId) {
            return insuredMarket.totalOpenValue;
        }
    }
}