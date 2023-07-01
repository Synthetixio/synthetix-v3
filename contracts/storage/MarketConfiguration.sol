//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

/**
 * @dev Global bfp-market configuration across all perp markets.
 */
library MarketConfiguration {
    struct Data {
        // A reference to the snxUSD stablecoin.
        ITokenModule snxUsdToken;
        // A reference back to the core Synthetix v3 system.
        ISynthetixSystem synthetix;
        // {collateralAddress: maxDepositAmountAllowed}.
        mapping(address => uint256) maxCollateralDeposits;
    }

    function load() internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.MarketConfiguration"));

        assembly {
            market.slot := s
        }
    }
}
