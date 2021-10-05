//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../utils/ContractUtil.sol";
import "hardhat/console.sol";

abstract contract UniversalProxyImplementation is ContractUtil {
    event Upgraded(address implementation);

    function _setImplementation(address newImplementation) internal virtual;

    function _getImplementation() internal view virtual returns (address);

    function upgradeTo(address newImplementation) public virtual;

    // WARNING: non-bricking protection was removed from the contract!!!
    // Remove this comment when #214 is done
    function _upgradeTo(address newImplementation) internal {
        require(newImplementation != address(0), "Implementation is zero address");
        require(_isContract(newImplementation), "Implementation not a contract");

        _setImplementation(newImplementation);

        emit Upgraded(newImplementation);
    }
}
