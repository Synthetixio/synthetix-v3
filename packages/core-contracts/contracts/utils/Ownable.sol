//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Ownable {
    address public owner;
    address public nominatedOwner;

    event OwnerNominated(address newOwner);
    event OwnerChanged(address oldOwner, address newOwner);

    constructor(address ownerCtor) {
        require(ownerCtor != address(0), "Owner address cannot be 0x0");
        owner = ownerCtor;
        emit OwnerChanged(address(0), ownerCtor);
    }

    function nominateNewOwner(address ownerNominated) external onlyOwner {
        nominatedOwner = ownerNominated;
        emit OwnerNominated(ownerNominated);
    }

    function acceptOwnership() external {
        require(msg.sender == nominatedOwner, "You must first be nominated");
        emit OwnerChanged(owner, nominatedOwner);
        owner = nominatedOwner;
        nominatedOwner = address(0);
    }

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() private view {
        require(msg.sender == owner, "Must be the contract owner");
    }
}
