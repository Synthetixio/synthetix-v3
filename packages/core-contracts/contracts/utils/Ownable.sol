//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "../interfaces/IOwnable.sol";

abstract contract Ownable is IOwnable {
    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function acceptOwnership() external virtual override {}

    function nominateNewOwner(address newOwner) external virtual override {}

    function renounceNomination() external virtual override {}

    function getOwner() external view virtual override returns (address) {}

    function getNominatedOwner() external view virtual override returns (address) {}

    function _onlyOwner() internal view virtual {}
}
