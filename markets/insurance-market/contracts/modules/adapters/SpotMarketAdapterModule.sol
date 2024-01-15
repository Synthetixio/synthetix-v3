//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../BasePolicyAdapterModule.sol";

import "@synthetixio/spot-market/contracts/interfaces/IAtomicOrderModule.sol";
import "@synthetixio/spot-market/contracts/interfaces/ISpotMarketFactoryModule.sol";

contract SpotAdapterModule is BaseAdapterPolicyModule {


    function _calculateAccountValue(InsuredMarket.Data storage insuredMarket, address account) internal override returns (uint) {
        uint synthBalance = IERC20(ISpotMarketFactoryModule(address(insuredMarket.targetMarket))
            .getSynth(insuredMarket.settings.insuredMarketId)
        )
            .balanceOf(account);

        return IAtomicOrderModule(address(insuredMarket.targetMarket))
            .quoteSellExactIn(insuredMarket.settings.insuredMarketId, synthBalance);
    }

    function _assumePosition(InsuredMarket.Data storage insuredMarket, address from, uint maxUsdAmount) internal override returns (uint) {
        uint maxSynthAssume = IAtomicOrderModule(address(insuredMarket.targetMarket))
            .quoteSellExactIn(insuredMarket.settings.insuredMarketId, maxUsdAmount);

        IERC20 synth = IERC20(ISpotMarketFactoryModule(address(insuredMarket.targetMarket))
            .getSynth(insuredMarket.settings.marketId)
        );

        uint synthBalance = synth.balanceOf(from);

        return synth.transferFrom(from, synthBalance < maxSynthAssume ? synthBalance : maxSynthAssume);
    }

    function _sellPosition(InsuredMarket.Data storage insuredMarket, uint amount) internal override returns (uint) {
        return IAtomicOrderModule(address(insuredMarket.targetMarket))
            .sellExactIn(insuredMarket.settings.marketId, amount, 0);
    }
}