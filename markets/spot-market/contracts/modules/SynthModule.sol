//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "../interfaces/ISynth.sol";

// solhint-disable-next-line no-empty-blocks
contract SynthModule is ISynth, ERC20, OwnableMixin {
    function burn(address from, uint256 amount) external override onlyOwner {
        _burn(from, amount);
    }

    function mint(address to, uint256 amount) external override onlyOwner {
        _mint(to, amount);
    }

    function setAllowance(
        address from,
        address spender,
        uint amount
    ) external override onlyOwner {
        _erc20Store().allowance[from][spender] = amount;
    }
}
