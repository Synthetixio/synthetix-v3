//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/interfaces/IERC721.sol";

/// @title NFT token identifying an Account
interface INftModule is IERC721 {

    /// @notice returns if `initialize` has been called by the owner
    function isInitialized() external returns (bool);

    /// @notice allows owner to initialize the token after attaching a proxy
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) external;

    /// @notice mints a new token (NFT) with the "requestedAccountId" id owned by "owner". It can ol=nly be called by the system
    function mint(address owner, uint requestedAccountId) external;
}
