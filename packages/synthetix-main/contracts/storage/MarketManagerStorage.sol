//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../utils/SharesLibrary.sol";
import "../utils/Heap.sol";

contract MarketManagerStorage {
    struct MarketManagerStore {
        mapping(uint => MarketData) markets;
        mapping(address => uint) marketIds;
        uint lastMarketId;
    }

    struct MarketData {
        address marketAddress;

        /// @notice the maximum amount of debt multiplied by the total liquidity shares
        int256 maxMarketDebtNominator;

        /// @notice the difference between the USD burnt by the market, and the amount minted
        int128 issuance;

        /// @notice the amount of debt the last time the debt was distributed
        int128 lastMarketBalance;
        
        // used to disconnect funds from a market if it goes above a certain debt per debt share
        Heap.Data fundMaxDebtShares;

        SharesLibrary.Distribution debtDist;
    }

    function _marketManagerStore() internal pure returns (MarketManagerStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.marketmanager")) - 1)
            store.slot := 0x38077fe0897d5edca02a59b2d0aa55ba8c04cdd9bb648f71ac154665d97109cd
        }
    }
}
