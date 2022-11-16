//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/interfaces/ITokenModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSProxy.sol";

library SynthUtil {
    using AssociatedSystem for AssociatedSystem.Data;

    function getToken(uint128 marketId) internal view returns (ITokenModule) {
        bytes32 synthId = getSystemId(marketId);
        return AssociatedSystem.load(synthId).asToken();
    }

    function getSystemId(uint128 marketId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(marketId));
    }
}
