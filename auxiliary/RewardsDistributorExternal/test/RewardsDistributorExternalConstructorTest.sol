// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file, var-name-mixedcase, func-name-mixedcase, no-empty-blocks
pragma solidity ^0.8.21;

import {Test} from "forge-std/Test.sol";
import {RewardsDistributorExternal} from "../src/RewardsDistributorExternal.sol";
import {ParameterError} from "@synthetixio/core-contracts/contracts/errors/ParameterError.sol";
import {MintableToken} from "./MintableToken.sol";

contract EmptyContract {}

contract RewardsDistributorExternalConstructorTest is Test {
    address private BOB;
    address private BOSS;
    address private EXTERNALDISTRIBUTOR;

    MintableToken internal sUSDC;
    EmptyContract internal rewardsManager;

    uint128 internal accountId = 1;
    uint128 internal poolId = 1;
    address internal collateralType;
    uint64 internal start = 12345678;
    uint32 internal duration = 3600;

    function setUp() public {
        BOB = vm.addr(0xB0B);
        EXTERNALDISTRIBUTOR = vm.addr(0x1337);
        rewardsManager = new EmptyContract();
        sUSDC = new MintableToken("sUSDC", 18);
        collateralType = address(sUSDC);
    }

    function test_constructor_wrongAuthorizedAddress() public {
        MintableToken T18D = new MintableToken("T18D", 18);
        vm.expectRevert(
            abi.encodeWithSelector(
                ParameterError.InvalidParameter.selector,
                "authorizedExternalDistributor",
                "Invalid address"
            )
        );

        new RewardsDistributorExternal(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T18D),
            18,
            "18 Decimals token payouts",
            address(0)
        );
    }

    function test_constructor_ok() public {
        MintableToken T18D = new MintableToken("T18D", 18);
        RewardsDistributorExternal rewardsDistributor = new RewardsDistributorExternal(
            address(rewardsManager),
            poolId,
            collateralType,
            address(T18D),
            18,
            "18 Decimals token payouts",
            address(EXTERNALDISTRIBUTOR)
        );
        assertEq(rewardsDistributor.precision(), 10 ** 18);
    }
}
