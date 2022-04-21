//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFundModule {
    function initializeFundModule() external;

    function isFundModuleInitialized() external view returns (bool);
}
