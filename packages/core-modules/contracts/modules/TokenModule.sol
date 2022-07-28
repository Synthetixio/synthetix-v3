//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "../interfaces/ITokenModule.sol";

contract TokenModule is ITokenModule, ERC20, InitializableMixin, OwnableMixin {

    function _isInitialized() internal view override returns (bool) {
        return _erc20Store().decimals != 0;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

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
