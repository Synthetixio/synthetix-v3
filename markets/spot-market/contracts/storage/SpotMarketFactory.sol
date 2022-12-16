//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "./Price.sol";
import "./Fee.sol";
import "./Wrapper.sol";

library SpotMarketFactory {
    bytes32 private constant _slotSpotMarketFactory =
        keccak256(abi.encode("io.synthetix.spot-market.SpotMarketFactory"));

    using Price for Price.Data;

    error OnlyMarketOwner(address marketOwner, address sender);

    struct Data {
        ITokenModule usdToken;
        IOracleManagerModule oracle;
        address synthetix;
        address initialSynthImplementation;
        mapping(uint128 => address) synthOwners;
        mapping(uint128 => int256) synthFeesCollected;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _slotSpotMarketFactory;
        assembly {
            store.slot := s
        }
    }

    function onlyMarketOwner(Data storage self, uint128 marketId) internal view {
        address marketOwner = self.synthOwners[marketId];

        if (marketOwner != msg.sender) {
            revert OnlyMarketOwner(marketOwner, msg.sender);
        }
    }
}
