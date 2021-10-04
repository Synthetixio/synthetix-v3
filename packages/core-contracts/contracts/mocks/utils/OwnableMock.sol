//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../../utils/Ownable.sol";

contract OwnableMock is Ownable {
    address public override owner;
    address public override nominatedOwner;

    constructor(address firstOwner) {
        require(firstOwner != address(0), "Owner cannot be 0x0");
        owner = firstOwner;
        emit OwnerChanged(address(0), firstOwner);
    }

    function nominateNewOwner(address ownerNominated) external override onlyOwner {
        nominatedOwner = ownerNominated;
        emit OwnerNominated(ownerNominated);
    }

    function acceptOwnership() external override {
        require(msg.sender == nominatedOwner, "You must first be nominated");
        emit OwnerChanged(owner, nominatedOwner);
        owner = nominatedOwner;
        nominatedOwner = address(0);
    }

    function _onlyOwner() internal view override {
        require(msg.sender == owner, "Only the owner can invoke");
    }
}
