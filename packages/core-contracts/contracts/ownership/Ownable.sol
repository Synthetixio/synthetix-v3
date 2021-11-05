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
        address currentNominatedOwner = _getNominatedOwner();
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated(msg.sender);
        }

        emit OwnerChanged(_ownableStorage().owner, currentNominatedOwner);
        _setOwner(currentNominatedOwner);

        _setNominatedOwner(address(0));
    }

    function nominateNewOwner(address newNominatedOwner) external onlyOwnerIfSet {
        if (newNominatedOwner == address(0)) {
            revert InvalidAddress(newNominatedOwner);
        }
        if (newNominatedOwner == _getNominatedOwner()) {
            revert InvalidNomination(newNominatedOwner);
        }

        _setNominatedOwner(newNominatedOwner);

        emit OwnerNominated(newNominatedOwner);
    }

    function renounceNomination() external onlyOwner {
        if (_getNominatedOwner() == address(0)) {
            revert NoNomination();
        }

        _setNominatedOwner(address(0));
    }

    function owner() external view returns (address) {
        return _ownableStorage().owner;
    }

    function nominatedOwner() external view returns (address) {
        return _ownableStorage().nominatedOwner;
    }

    function _getNominatedOwner() internal view returns (address) {
        return _ownableStorage().nominatedOwner;
    }

    function _setOwner(address newOwner) internal {
        _ownableStorage().owner = newOwner;
    }

    function _setNominatedOwner(address newNominatedOwner) internal {
        _ownableStorage().nominatedOwner = newNominatedOwner;
    }
}
