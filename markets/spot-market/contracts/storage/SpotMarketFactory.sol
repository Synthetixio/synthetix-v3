//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "../interfaces/ISpotMarketFactoryModule.sol";
import "./Price.sol";
import "./Fee.sol";
import "./Wrapper.sol";

/**
 * @title Main factory library that registers synths.  Also houses global configuration for all synths.
 */
library SpotMarketFactory {
    bytes32 private constant _SLOT_SPOT_MARKET_FACTORY =
        keccak256(abi.encode("io.synthetix.spot-market.SpotMarketFactory"));

    using Price for Price.Data;

    error OnlyMarketOwner(address marketOwner, address sender);
    error InvalidMarket(uint128 marketId);

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
         * @dev Synthetix core v3 proxy address
         */
        address synthetix;
        /**
         * @dev when synth is registered, this is the initial implementation address the proxy services.
         */
        address initialSynthImplementation;
        address initialAsyncOrderClaimImplementation;
        /**
         * @dev mapping of marketId to marketOwner
         */
        mapping(uint128 => address) synthOwners;
    }

    enum TransactionType {
        BUY,
        SELL,
        ASYNC_BUY,
        ASYNC_SELL,
        WRAP,
        UNWRAP
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_SPOT_MARKET_FACTORY;
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

    function isValidMarket(Data storage self, uint128 marketId) internal view returns (bool) {
        if (self.synthOwners[marketId] == address(0)) {
            revert InvalidMarket(marketId);
        }
    }

    /**
     * @dev first creates an allowance entry in usdToken for market manager, then deposits snxUSD amount into mm.
     */
    function depositToMarketManager(Data storage self, uint128 marketId, uint256 amount) internal {
        self.usdToken.approve(address(this), amount);
        IMarketManagerModule(self.synthetix).depositMarketUsd(marketId, address(this), amount);
    }
}
