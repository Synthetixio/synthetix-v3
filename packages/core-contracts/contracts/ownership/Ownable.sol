//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./OwnableMixin.sol";
import "../common/CommonErrors.sol";

abstract contract Ownable is OwnableMixin, CommonErrors {
    error NotNominated();
    error InvalidNomination();

    event OwnerNominated(address newOwner);

    event OwnerChanged(address oldOwner, address newOwner);

    function acceptOwnership() external {
        address currentNominatedOwner = _getNominatedOwner();
        if (msg.sender != currentNominatedOwner) {
            revert NotNominated();
        }

        emit OwnerChanged(_getOwner(), currentNominatedOwner);
        _setOwner(currentNominatedOwner);

        _setNominatedOwner(address(0));
    }

    function nominateNewOwner(address newNominatedOwner) external onlyOwnerIfSet {
        if (newNominatedOwner == address(0)) {
            revert InvalidAddress();
        }
        if (newNominatedOwner == _getNominatedOwner()) {
            revert InvalidNomination();
        }

        _setNominatedOwner(newNominatedOwner);

        emit OwnerNominated(newNominatedOwner);
    }

    function renounceNomination() external onlyOwner {
        if (_getNominatedOwner() == address(0)) {
            revert NotNominated();
        }

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
