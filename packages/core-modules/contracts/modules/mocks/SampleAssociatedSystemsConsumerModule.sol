//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../mixins/AssociatedSystemsMixin.sol";
import "../../storage/SampleStorage.sol";
import "../../interfaces/IAssociatedSystemsConsumerModule.sol";

contract SampleAssociatedSystemsConsumerModule is AssociatedSystemsMixin, IAssociatedSystemsConsumerModule {
    error WrongValue();

    function getToken(bytes32 id) public view override returns (address) {
        return address(_getToken(id));
    }

    function getNft(bytes32 id) public view override returns (address) {
        return address(_getToken(id));
    }
}
