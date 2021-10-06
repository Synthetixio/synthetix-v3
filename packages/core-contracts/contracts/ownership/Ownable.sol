//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./OwnableMixin.sol";

abstract contract Ownable is OwnableMixin {
    event OwnerNominated(address newOwner);

    event OwnerChanged(address oldOwner, address newOwner);

    function acceptOwnership() external {
        address currentNominatedOwner = _getNominatedOwner();
        require(msg.sender == currentNominatedOwner, "Not nominated");

        emit OwnerChanged(_getOwner(), currentNominatedOwner);
        _setOwner(currentNominatedOwner);

        _setNominatedOwner(address(0));
    }

    function nominateNewOwner(address newNominatedOwner) external onlyOwnerIfSet {
        require(newNominatedOwner != address(0), "Cannot nominate 0x0");
        require(newNominatedOwner != _getNominatedOwner(), "Cannot nominate current address");

        _setNominatedOwner(newNominatedOwner);

        emit OwnerNominated(newNominatedOwner);
    }

    function renounceNomination() external onlyOwner {
        require(_getNominatedOwner() != address(0), "No nomination to renounce");

        _setNominatedOwner(address(0));
    }

    function owner() external view virtual returns (address) {
        return _getOwner();
    }

    function nominatedOwner() external view virtual returns (address) {
        return _getNominatedOwner();
    }

    function _setOwner(address newOwner) internal virtual;

    function _getOwner() internal view virtual override returns (address);

    function _setNominatedOwner(address newNominatedOwner) internal virtual;

    function _getNominatedOwner() internal view virtual returns (address);
}
