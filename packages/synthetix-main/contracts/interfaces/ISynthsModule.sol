//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ISynthsModule {
    error BeaconAlreadyCreated();
    error BeaconNotCreated();
    error ImplementationNotSet();
    error SynthAlreadyCreated();

    event BeaconCreated(address beacon);
    event SynthCreated(bytes32 synth, address synthAddress);

    function createBeacon() external;

    function createSynth(
        bytes32 synth,
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external;

    function upgradeSynthImplementation(address newSynthsImplementation) external;

    function getBeacon() external view returns (address);

    function getSynthImplementation() external view returns (address);

    function getSynth(bytes32 synth) external view returns (address);
}
