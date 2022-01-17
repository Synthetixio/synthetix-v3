//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISynthsModule {
    function initializeSynthsModule() external;

    function isSynthsModuleInitialized() external view returns (bool);

    function createSynth(
        bytes32 synth,
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external;

    function upgradeSynthImplementation(address newSynthsImplementation) external;

    function createSynthImplementation() external;

    function getBeacon() external view returns (address);

    function getSynthImplementation() external view returns (address);

    function getSynth(bytes32 synth) external view returns (address);
}
