//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ElectionModuleSatellite {
    function cast(
        address[] calldata candidates,
        uint256[] calldata amounts
    ) public virtual override {
        // TODO: cast the vote to mothership
    }

    function _recvDismissMembers(address[] calldata membersToDismiss) external override {
        // TODO: burn nfts from received members
    }

    function _recvResolve(address[] calldata winners, uint256 newEpochIndex) external {
        // TODO: distribute nfts to winners
    }
}
