// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {IERC7412} from "./IERC7412.sol";

interface IWormholeERC7412Receiver is IERC7412 {
    struct CrossChainRequest {
        uint64 chainSelector;
        uint256 timestamp;
        address target;
        bytes data;
    }

    function getCrossChainData(
        CrossChainRequest[] memory reqs,
        uint256 maxAge
    ) external view returns (bytes[] memory);
}
