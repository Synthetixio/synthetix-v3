//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

contract ElectionModule is ERC20 {
    function getNominees() public view returns (address[]);

    function selfNominate() external;

    function selfUnnominate() external;
}
