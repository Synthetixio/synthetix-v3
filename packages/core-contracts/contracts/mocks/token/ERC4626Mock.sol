//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../token/ERC4626.sol";

contract ERC4626Mock is ERC4626 {
    function initialize(
        address assetAddress,
        string memory tokenName,
        string memory tokenSymbol
    ) public {
        _initialize(assetAddress, tokenName, tokenSymbol);
    }
}
