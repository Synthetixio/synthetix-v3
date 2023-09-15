//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../interfaces/external/ISynthetixSystem.sol";

/**
 * @title Main factory library that registers synths.  Also houses global configuration for all synths.
 */
library SpotMarketFactory {
    bytes32 private constant _SLOT_SPOT_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.spot-market.SpotMarketFactory"));

    error OnlyMarketOwner(address marketOwner, address sender);
    error InvalidMarket(uint128 marketId);
    error InvalidSynthImplementation(uint256 synthImplementation);

    struct Data {
        /**
         * @dev snxUSD token address
         */
        ITokenModule usdToken;
        /**
         * @dev oracle manager address used for price feeds
         */
        INodeModule oracle;
        /**
         * @dev Synthetix core v3 proxy
         */
        ISynthetixSystem synthetix;
        /**
         * @dev erc20 synth implementation address.  associated systems creates a proxy backed by this implementation.
         */
        address synthImplementation;
        /**
         * @dev mapping of marketId to marketOwner
         */
        mapping(uint128 => address) marketOwners;
        /**
         * @dev mapping of marketId to marketNominatedOwner
         */
        mapping(uint128 => address) nominatedMarketOwners;
    }

    function load() internal pure returns (Data storage spotMarketFactory) {
        bytes32 s = _SLOT_SPOT_MARKET_FACTORY;
        assembly {
            spotMarketFactory.slot := s
        }
    }

    /**
     * @notice ensures synth implementation is set before creating synth
     */
    function checkSynthImplemention(Data storage self) internal view {
        if (self.synthImplementation == address(0)) {
            revert InvalidSynthImplementation(0);
        }
    }

    /**
     * @notice only owner of market passes check, otherwise reverts
     */
    function onlyMarketOwner(Data storage self, uint128 marketId) internal view {
        address marketOwner = self.marketOwners[marketId];

        if (marketOwner != ERC2771Context._msgSender()) {
            revert OnlyMarketOwner(marketOwner, ERC2771Context._msgSender());
        }
    }

    /**
     * @notice validates market id by checking that an owner exists for the market
     */
    function validateMarket(Data storage self, uint128 marketId) internal view {
        if (self.marketOwners[marketId] == address(0)) {
            revert InvalidMarket(marketId);
        }
    }

    /**
     * @dev first creates an allowance entry in usdToken for market manager, then deposits snxUSD amount into mm.
     */
    function depositToMarketManager(Data storage self, uint128 marketId, uint256 amount) internal {
        self.usdToken.approve(address(this), amount);
        self.synthetix.depositMarketUsd(marketId, address(this), amount);
    }
}
