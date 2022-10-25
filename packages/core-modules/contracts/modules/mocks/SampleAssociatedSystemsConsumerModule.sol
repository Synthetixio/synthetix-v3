//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../storage/AssociatedSystem.sol";
import "../../interfaces/IAssociatedSystemsConsumerModule.sol";

contract SampleAssociatedSystemsConsumerModule is IAssociatedSystemsConsumerModule {
    using AssociatedSystem for AssociatedSystem.Data;

    error WrongValue();

    function getToken(bytes32 id) public view override returns (address) {
        return address(AssociatedSystem.load(id).asToken());
    }

    function getNft(bytes32 id) public view override returns (address) {
        return address(AssociatedSystem.load(id).asNft());
    }
}
