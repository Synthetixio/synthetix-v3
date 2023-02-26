//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";

import "../interfaces/external/ISynthetixSystem.sol";

/**
 * @title Main factory library that registers perps markets.  Also houses global configuration for all perps markets.
 */
library PerpsMarketFactory {
    bytes32 private constant _SLOT_PERPS_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketFactory"));

    error OnlyMarketOwner(address marketOwner, address sender);
    error InvalidMarket(uint128 marketId);

    struct Data {
        /**
         * @dev oracle manager address used for price feeds
         */
        INodeModule oracle;
        ITokenModule usdToken;
        /**
         * @dev Synthetix core v3 proxy address
         */
        ISynthetixSystem synthetix;
    }

    function load() internal pure returns (Data storage perpsMarketFactory) {
        bytes32 s = _SLOT_PERPS_MARKET_FACTORY;
        assembly {
            perpsMarketFactory.slot := s
        }
    }
}
