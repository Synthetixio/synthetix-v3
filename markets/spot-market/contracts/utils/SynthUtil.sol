//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {ISynthTokenModule} from "../interfaces/ISynthTokenModule.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";

library SynthUtil {
    using AssociatedSystem for AssociatedSystem.Data;

    function getToken(uint128 marketId) internal view returns (ISynthTokenModule) {
        bytes32 synthId = getSystemId(marketId);

        // ISynthTokenModule inherits from IDecayTokenModule, which inherits from ITokenModule so
        // this is a safe conversion as long as you know that the ITokenModule returned by the token
        // type was initialized by us
        return ISynthTokenModule(AssociatedSystem.load(synthId).proxy);
    }

    function getSystemId(uint128 marketId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("synth", marketId));
    }

    function getSynthTokenAddress(uint128 marketId) internal view returns (address) {
        return AssociatedSystem.load(SynthUtil.getSystemId(marketId)).proxy;
    }
}
