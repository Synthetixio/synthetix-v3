//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Order} from "./Order.sol";
import {Position} from "./Position.sol";

/**
 * @dev Storage for a specific perp market within the bfp-market.
 *
 * As of writing this, there will _only be one_ perp market (i.e. wstETH) however, this allows
 * bfp-market to extend to allow more in the future.
 *
 * We track the marketId here because each PerpMarket is a separate market in Synthetix core.
 */
library PerpMarket {
    // --- Errors --- //

    error MarketNotFound(uint128 id);

    // --- Storage --- //

    struct Data {
        // A unique market id for market reference.
        uint128 id;
        // Semi readable key e.g. bytes32(WSTETHPERP) for this market.
        bytes32 key;
        // sum(positions.map(p => p.size)).
        int256 skew;
        // sum(positions.map(p => abs(p.size))).
        uint256 size;
        // The value of the funding rate last time this was computed.
        int256 fundingRateLastComputed;
        // The value (in native units) of total market funding accumulated.
        int256 fundingAccumulationLastComputed;
        // block.timestamp of when funding was last computed.
        uint256 lastFundingTime;
        // {accountId: Order}.
        mapping(uint128 => Order.Data) orders;
        // {accountId: Position}.
        mapping(uint128 => Position.Data) positions;
        // {collateralAddress: totalDeposited}
        mapping(address => uint256) totalCollateralDeposited;
    }

    function load(uint128 id) internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarket", id));

        assembly {
            market.slot := s
        }
    }

    /**
     * @dev Reverts if the market does not exist with appropriate error. Otherwise, returns the market.
     */
    function exists(uint128 id) internal view returns (Data storage market) {
        Data storage m = load(id);
        if (m.id == 0) {
            revert MarketNotFound(id);
        }
        return m;
    }
}
