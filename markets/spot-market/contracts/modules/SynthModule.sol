//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20Storage.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

import "../interfaces/ISynth.sol";

// solhint-disable-next-line no-empty-blocks
contract SynthModule is ISynth, ERC20 {
    function burn(address from, uint256 amount) external override {
        OwnableStorage.onlyOwner();
        _burn(from, amount);
    }

    function mint(address to, uint256 amount) external override {
        OwnableStorage.onlyOwner();
        _mint(to, amount);
    }

    function setAllowance(
        address from,
        address spender,
        uint amount
    ) external override {
        OwnableStorage.onlyOwner();
        ERC20Storage.load().allowance[from][spender] = amount;
    }
}
