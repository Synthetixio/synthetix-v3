//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "./SynthConfig.sol";
import "./Price.sol";
import "./Fee.sol";
import "./Wrapper.sol";

library SpotMarketFactory {
    using Price for Price.Data;

    error OnlyMarketOwner(address marketOwner, address sender);

    struct Data {
        ITokenModule usdToken;
        address synthetix;
        mapping(uint128 => SynthConfig.Data) synthConfigs;
        mapping(uint128 => uint) synthFeesCollected;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("SpotMarketFactory"));
        assembly {
            store.slot := s
        }
    }

    function onlyMarketOwner(Data storage self, uint128 marketId) internal view {
        address marketOwner = self.synthConfigs[marketId].owner;

        if (marketOwner != msg.sender) {
            revert OnlyMarketOwner(marketOwner, msg.sender);
        }
    }

    function loadSynth(uint128 marketId) internal view returns (SynthConfig.Data storage store) {
        return load().synthConfigs[marketId];
    }

    function getPriceData(SpotMarketFactory.Data storage self, uint128 marketId) internal view returns (Price.Data storage) {
        return self.synthConfigs[marketId].priceData;
    }

    function getFeeData(SpotMarketFactory.Data storage self, uint128 marketId) internal view returns (Fee.Data storage) {
        return self.synthConfigs[marketId].feeData;
    }

    function getWrapperData(SpotMarketFactory.Data storage self, uint128 marketId)
        internal
        view
        returns (Wrapper.Data storage)
    {
        return self.synthConfigs[marketId].wrapperData;
    }

    function getCurrentPrice(SpotMarketFactory.Data storage self, uint128 marketId) internal view returns (uint) {
        return getPriceData(self, marketId).getCurrentPrice();
    }
}
