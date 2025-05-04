
//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IClaimModule {
    function claim(
        uint128 policyId,
        uint claimAmount
    ) external;
}