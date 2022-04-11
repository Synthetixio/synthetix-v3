//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/ISatelliteFactory.sol";

interface ISynthsModule is ISatelliteFactory {
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

    function setNewSynthAuthorizedSystem(address authorized) external;

    function getSynth(bytes32 synth) external view returns (address);

    function getSynthsModuleSatellites() external view returns (Satellite[] memory);
}
