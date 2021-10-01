//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

abstract contract Ownable {
    event OwnerNominated(address newOwner);
    event OwnerChanged(address oldOwner, address newOwner);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function nominateNewOwner(address ownerNominated) external virtual {}

    function acceptOwnership() external virtual {}

    function _onlyOwner() internal view virtual {}
}
