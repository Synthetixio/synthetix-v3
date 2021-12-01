//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IAddressError.sol";

interface IBeacon is IAddressError {
    function getImplementation() external view returns (address);

    function upgradeTo(address newImplementation) external;
}
