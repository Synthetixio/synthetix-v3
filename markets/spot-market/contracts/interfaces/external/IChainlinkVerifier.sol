//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

interface IChainlinkVerifier {
    function verify(bytes memory chainlinkBlob) external returns (bytes memory verifierResponse);
}
