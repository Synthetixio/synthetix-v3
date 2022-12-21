//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/AssociatedSystemsModule.sol";

import "../interfaces/IFeeConfigurationModule.sol";
import "../interfaces/ISynthTokenModule.sol";
import "../storage/SpotMarketFactory.sol";

contract FeeConfigurationModule is IFeeConfigurationModule {
    using SpotMarketFactory for SpotMarketFactory.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    function setFixedFee(uint128 synthMarketId, uint fixedFee) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.fixedFee = fixedFee;

        emit FixedFeeSet(synthMarketId, fixedFee);
    }

    function setMarketSkewFees(uint128 synthMarketId, uint skewScale) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.skewScale = skewScale;

        emit MarketSkewFeesSet(synthMarketId, skewScale);
    }

    function setMarketUtilizationFees(
        uint128 synthMarketId,
        uint utilizationFeeRate
    ) external override {
        SpotMarketFactory.load().onlyMarketOwner(synthMarketId);

        Fee.Data storage fee = Fee.load(synthMarketId);
        fee.utilizationFeeRate = utilizationFeeRate;

        emit MarketUtilizationFeesSet(synthMarketId, utilizationFeeRate);
    }

    function setInterestRate(uint128 marketId, uint256 interestRate) public {
        SpotMarketFactory.load().onlyMarketOwner(marketId);

        ISynthTokenModule synthTokenModule = ISynthTokenModule(
            SynthUtil.getSynthTokenAddress(marketId)
        );
        synthTokenModule.setInterestRate(interestRate);

        emit InterestRateSet(marketId, interestRate);
    }

    function setCustomTransactorFees() external override {
        // TODO
        /*
        Direct integrations:
            fixed fee override
            buy and sell feed node id override
        */
    }
}
