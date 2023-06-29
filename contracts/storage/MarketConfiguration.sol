//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

library MarketConfiguration {
    struct Data {
        // A reference to the snxUSD stablecoin
        ITokenModule usdToken;
        // A reference back to the core Synthetix v3 system
        ISynthetixSystem synthetix;
        // collateral => amount (native)
        mapping(uint128 => uint256) amountMaxByCollateral;
        // accountId => amount (native)
        mapping(uint128 => uint256) amountByAccount;
        // collateral => amount (native)
        mapping(uint128 => uint256) amountByCollateral;
    }

    function load() internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.MarketConfiguration"));

        assembly {
            market.slot := s
        }
    }
}
