//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

// https://docs.synthetix.io/contracts/source/interfaces/iaddressresolver
interface IAddressResolver {
    function getAddress(bytes32 name) external view returns (address);

    function getSynth(bytes32 key) external view returns (address);

    function requireAndGetAddress(
        bytes32 name,
        string calldata reason
    ) external view returns (address);
}
