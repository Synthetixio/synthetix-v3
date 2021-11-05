//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OwnableMixin.sol";
import "../common/CommonErrors.sol";

contract Ownable is OwnableMixin, CommonErrors {
    error NotNominated(address addr);
    error InvalidNomination(address addr);
    error NoNomination();

    event OwnerNominated(address newOwner);

    event OwnerChanged(address oldOwner, address newOwner);

    function acceptOwnership() external {
        address currentNominatedOwner = _ownableStorage().nominatedOwner;
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit OwnerChanged(_ownableStorage().owner, currentNominatedOwner);
        _ownableStorage().owner = currentNominatedOwner;

        _ownableStorage().nominatedOwner = address(0);
    }

    function nominateNewOwner(address newNominatedOwner) external onlyOwnerIfSet {
        if (newNominatedOwner == address(0)) {
            revert InvalidAddress(newNominatedOwner);
        }

        if (newNominatedOwner == _ownableStorage().nominatedOwner) {
            revert InvalidNomination(newNominatedOwner);
        }

        _ownableStorage().nominatedOwner = newNominatedOwner;
        emit OwnerNominated(newNominatedOwner);
    }

    function renounceNomination() external onlyOwner {
        if (_ownableStorage().nominatedOwner == address(0)) {
            revert NoNomination();
        }

        _ownableStorage().nominatedOwner = address(0);
    }

    function owner() external view returns (address) {
        return _ownableStorage().owner;
    }

    function nominatedOwner() external view returns (address) {
        return _ownableStorage().nominatedOwner;
    }
}
