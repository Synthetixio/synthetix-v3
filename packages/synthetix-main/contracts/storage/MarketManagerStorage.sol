//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MarketManagerStorage {
    struct MarketManagerStore {
        mapping(uint => MarketData) markets;
        mapping(address => uint) marketIds;
        uint lastMarketId;
    }

    struct MarketData {
        address marketAddress;
        int256 issuance; // TODO this can be negative. How to deal with that?
        uint256 totalDelegatedCollateralValue;
        uint256 totalLiquidityShares;
        uint256 maxMarketDebtShare;
        // credit shares
        mapping(uint => uint256) fundliquidityShares;
        mapping(uint => int256) fundInitialBalance;
        mapping(uint => uint256) fundMaxDebtShareValue;
    }

    function _marketManagerStore() internal pure returns (MarketManagerStore storage store) {
        assembly {
            // bytes32(uint(keccak256("io.synthetix.snx.marketmanager")) - 1)
            store.slot := 0x38077fe0897d5edca02a59b2d0aa55ba8c04cdd9bb648f71ac154665d97109cd
        }
    }
}
