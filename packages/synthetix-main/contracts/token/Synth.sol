//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/Authorizable.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "../interfaces/ISynth.sol";

contract Synth is ERC20, ISynth, Authorizable {
    function initialize(
        string memory synthName,
        string memory synthSymbol,
        uint8 synthDecimals
    ) external override {
        _initialize(synthName, synthSymbol, synthDecimals);
    }

    function mint(address recipient, uint256 amount) external onlyAuthorized {
        _mint(recipient, amount);
    }

    function burn(address recipient, uint256 amount) external onlyAuthorized {
        _burn(recipient, amount);
    }
}
