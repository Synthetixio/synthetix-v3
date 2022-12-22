//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/INftModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

import "../../contracts/interfaces/IAsyncOrderClaimTokenModule.sol";

library AsyncOrderClaimTokenUtil {
    using AssociatedSystem for AssociatedSystem.Data;

    function getNft(uint128 marketId) internal view returns (IAsyncOrderClaimTokenModule) {
        bytes32 synthId = getSystemId(marketId);
        return IAsyncOrderClaimTokenModule(address(AssociatedSystem.load(synthId).asNft()));
    }

    function getSystemId(uint128 marketId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("asyncorderclaim", marketId));
    }
}
