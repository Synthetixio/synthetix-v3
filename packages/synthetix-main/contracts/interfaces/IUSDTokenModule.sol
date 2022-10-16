//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";

/// @title Module for managing snxUSD token as a Satellite
interface IUSDTokenModule is ITokenModule {
    function burnWithAllowance(
        address from,
        address spender,
        uint amount
    ) external;
}
