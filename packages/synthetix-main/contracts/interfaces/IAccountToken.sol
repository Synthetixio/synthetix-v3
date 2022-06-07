//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";

/// @title NFT token identifying an Account
interface IAccountToken is IERC721 {
    /// @notice mints a new token (NFT) with the "requestedAccountId" id owned by "owner".
    function mint(address owner, uint requestedAccountId) external;

    /// @notice mints a new token (NFT) with at the next available id owned by "owner".
    function mintNext(address owner) external returns (uint256 accountId);
}
