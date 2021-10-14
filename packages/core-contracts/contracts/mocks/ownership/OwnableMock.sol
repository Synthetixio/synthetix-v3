//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../../ownership/Ownable.sol";

contract OwnableMock is Ownable {
    address public override owner;
    address public override nominatedOwner;

    constructor(address firstOwner) {
        _setOwner(firstOwner);

        emit OwnerChanged(address(0), firstOwner);
    }

    function _setOwner(address newOwner) internal override {
        owner = newOwner;
    }

    function _getOwner() internal view override returns (address) {
        return owner;
    }

    function _setNominatedOwner(address newNominatedOwner) internal override {
        nominatedOwner = newNominatedOwner;
    }

    function _getNominatedOwner() internal view override returns (address) {
        return nominatedOwner;
    }
}
