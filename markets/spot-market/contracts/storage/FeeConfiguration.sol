//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/external/IFeeCollector.sol";

/**
 * @title Fee storage that tracks all fees for a given market Id.
 */
library FeeConfiguration {
    struct Data {
        /**
         * @dev The atomic fixed fee rate for a specific transactor.  Useful for direct integrations to set custom fees for specific addresses.
         */
        mapping(address => uint) atomicFixedFeeOverrides;
        /**
         * @dev atomic buy/sell fixed fee that's applied on all trades. In Bips, 18 decimals
         */
        uint atomicFixedFee;
        uint asyncFixedFee;
        /**
         * @dev utilization fee rate in Bips is the rate of fees applied based on the ratio of delegated collateral to total outstanding synth exposure. 18 decimals
         * applied on buy trades only.
         */
        uint utilizationFeeRate;
        /**
         * @dev wrapping fee rate in bips, 18 decimals
         */
        int wrapFixedFee;
        /**
         * @dev unwrapping fee rate in bips, 18 decimals
         */
        int unwrapFixedFee;
        /**
         * @dev skewScale is used to determine % of fees that get applied based on the ratio of outsanding synths to skewScale.
         * if outstanding synths = skew scale, then 100% premium is applied to the trade.
         * A negative skew, derived based on the mentioned ratio, is applied on sell trades
         */
        uint skewScale;
        /**
         * @dev The fee collector gets sent the calculated fees and can keep some of them to distribute in whichever way it wants.
         * The rest of the fees are deposited into the market manager.
         */
        IFeeCollector feeCollector;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    /**
     * @dev Set custom fee for transactor
     */
    function setAtomicFixedFeeOverride(
        uint128 marketId,
        address transactor,
        uint fixedFee
    ) internal {
        load(marketId).atomicFixedFeeOverrides[transactor] = fixedFee;
    }
}
