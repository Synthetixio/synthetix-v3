//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {Error} from "./Error.sol";
import {Order} from "./Order.sol";
import {PerpMarket} from "./PerpMarket.sol";
import {PerpMarketFactoryConfiguration} from "./PerpMarketFactoryConfiguration.sol";

library PerpCollateral {
    using PerpMarket for PerpMarket.Data;

    // --- Storage --- //

    struct Data {
        // Owner of position.
        uint128 accountId;
        // Market this position belongs to (e.g. wstETHPERP)
        uint128 marketId;
        // {CollateralAddress: amountUsed} (Tokens used to collateralise this position).
        mapping(address => uint256) collateral;
    }

    function load(uint128 accountId, uint128 marketId) internal pure returns (PerpCollateral.Data storage collateral) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpCollateral", accountId, marketId));

        assembly {
            collateral.slot := s
        }
    }
}
