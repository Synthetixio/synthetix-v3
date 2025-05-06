// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";

import {ITreasuryMarket} from "../contracts/interfaces/ITreasuryMarket.sol";
import {IV3CoreProxy} from "../contracts/interfaces/external/IV3CoreProxy.sol";
import {IERC721} from "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";

contract RestorePosition is Script {
    function restoreMainnet(
        uint128 accountId,
        address to,
        uint256 saddledAmount,
        uint256 loanAmount
    ) external {
        IV3CoreProxy v3System = IV3CoreProxy(0xffffffaEff0B96Ea8e4f94b2253f31abdD875847);
        ITreasuryMarket market = ITreasuryMarket(0x7b952507306E7D983bcFe6942Ac9F2f75C1332D8);
        address snxToken = 0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F;
        v3System.createAccount(accountId);
        v3System.deposit(accountId, snxToken, saddledAmount);
        v3System.delegateCollateral(accountId, 8, snxToken, saddledAmount, 1 ether);
        market.saddle(accountId);
        market.adjustLoan(accountId, loanAmount);
        IERC721(v3System.getAccountTokenAddress()).transferFrom(address(this), to, accountId);
    }

    function restoreOptimism(
        uint128 accountId,
        address to,
        uint256 saddledAmount,
        uint256 loanAmount
    ) external {
        IV3CoreProxy v3System = IV3CoreProxy(0xffffffaEff0B96Ea8e4f94b2253f31abdD875847);
        ITreasuryMarket market = ITreasuryMarket(0x421dEc7c865469128c76f910351DF693cBf6Bf04);
        address snxToken = 0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4;
        v3System.createAccount(accountId);
        v3System.deposit(accountId, snxToken, saddledAmount);
        v3System.delegateCollateral(accountId, 8, snxToken, saddledAmount, 1 ether);
        market.saddle(accountId);
        market.adjustLoan(accountId, loanAmount);
        IERC721(v3System.getAccountTokenAddress()).transferFrom(address(this), to, accountId);
    }
}
