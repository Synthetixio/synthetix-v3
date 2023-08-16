//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";
import {ISpotMarketSystem} from "../interfaces/external/ISpotMarketSystem.sol";

/**
 * @title Main factory library that registers perps markets.  Also houses global configuration for all perps markets.
 */
library PerpsMarketFactory {
    bytes32 private constant _SLOT_PERPS_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.perps-market.PerpsMarketFactory"));

    error PerpsMarketNotInitialized();
    error PerpsMarketAlreadyInitialized();

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
        ISpotMarketSystem spotMarket;
        uint128 perpsMarketId;
        address owner;
        address nominatedOwner;
    }

    function onlyIfInitialized(Data storage self) internal view {
        if (self.perpsMarketId == 0) {
            revert PerpsMarketNotInitialized();
        }
    }

    function onlyIfNotInitialized(Data storage self) internal view {
        if (self.perpsMarketId != 0) {
            revert PerpsMarketAlreadyInitialized();
        }
    }

    function load() internal pure returns (Data storage perpsMarketFactory) {
        bytes32 s = _SLOT_PERPS_MARKET_FACTORY;
        assembly {
            perpsMarketFactory.slot := s
        }
    }

    function depositMarketCollateral(
        Data storage self,
        ITokenModule collateral,
        uint256 amount
    ) internal {
        collateral.approve(address(self.synthetix), amount);
        self.synthetix.depositMarketCollateral(self.perpsMarketId, address(collateral), amount);
    }

    function depositMarketUsd(Data storage self, uint256 amount) internal {
        self.usdToken.approve(address(this), amount);
        self.synthetix.depositMarketUsd(self.perpsMarketId, address(this), amount);
    }

    function withdrawMarketUsd(Data storage self, address to, uint256 amount) internal {
        self.synthetix.withdrawMarketUsd(self.perpsMarketId, to, amount);
    }
}
