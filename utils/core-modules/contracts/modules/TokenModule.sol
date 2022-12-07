//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "../interfaces/ITokenModule.sol";

/**
 * @title Module wrapping an ERC20 token implementation.
 * See ITokenModule.
 */
contract TokenModule is ITokenModule, ERC20, InitializableMixin {
    /**
     * @inheritdoc ITokenModule
     */
    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    /**
     * @inheritdoc ITokenModule
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        OwnableStorage.onlyOwner();
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function burn(address from, uint256 amount) external override {
        OwnableStorage.onlyOwner();
        _burn(from, amount);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function mint(address to, uint256 amount) external override {
        OwnableStorage.onlyOwner();
        _mint(to, amount);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function setAllowance(address from, address spender, uint amount) external override {
        OwnableStorage.onlyOwner();
        ERC20Storage.load().allowance[from][spender] = amount;
    }

    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }
}
