//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ITokenModule} from "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import {INodeModule} from "@synthetixio/oracle-manager/contracts/interfaces/INodeModule.sol";
import {ISynthetixSystem} from "../external/ISynthetixSystem.sol";

/**
 * @dev Global bfp-market configuration across all perp markets.
 */
library PerpMarketFactoryConfiguration {
    struct Data {
        // A reference to the core Synthetix v3 system.
        ISynthetixSystem synthetix;
        // A reference to the snxUSD stablecoin.
        ITokenModule snxUsdToken;
        // A reference to the Synthetix oracle manager (used to fetch market prices).
        INodeModule oracleManager;
        // {collateralAddress: maxDepositAmountAllowed} (globally for all bfp markets).
        mapping(address => uint256) maxCollateralDeposits;
    }

    function load() internal pure returns (Data storage market) {
        bytes32 s = keccak256(abi.encode("io.synthetix.bfp-market.PerpMarketFactoryConfiguration"));

        assembly {
            market.slot := s
        }
    }
}
