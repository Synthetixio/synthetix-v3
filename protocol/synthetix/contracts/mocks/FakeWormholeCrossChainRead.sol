//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/external/IWormholeERC7412Receiver.sol";

contract FakeWormholeCrossChainRead is IWormholeERC7412Receiver {
    mapping(bytes32 => bytes) public queryResponses;

    function getCrossChainData(
        IWormholeERC7412Receiver.CrossChainRequest[] memory reqs,
        uint256 maxAge
    ) external view override returns (bytes[] memory responses) {
        responses = new bytes[](reqs.length);
        for (uint i = 0; i < reqs.length; i++) {
            CrossChainRequest memory req = reqs[i];
            bytes32 reqHash = keccak256(abi.encodePacked(req.chainSelector, req.target, req.data));

            responses[i] = queryResponses[reqHash];
        }
    }

    function setCrossChainData(
        uint64 chainSelector,
        address target,
        bytes memory callData,
        bytes memory response
    ) external {
        bytes32 reqHash = keccak256(abi.encodePacked(chainSelector, target, callData));
        queryResponses[reqHash] = response;
    }

    function fulfillOracleQuery(bytes calldata signedOffchainData) external payable {}

    function oracleId() external view returns (bytes32) {
        return "DUMMY";
    }
}
