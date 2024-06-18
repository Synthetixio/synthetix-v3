//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../interfaces/ITokenModule.sol";
import "../storage/Initialized.sol";

/**
 * @title Module wrapping an ERC20 token implementation.
 * See ITokenModule.
 */
contract TokenModule is ITokenModule, ERC20, InitializableMixin {
    bytes32 internal constant _INITIALIZED_NAME = "TokenModule";

    /**
     * @inheritdoc ITokenModule
     */
    function isInitialized() external view virtual returns (bool) {
        return _isInitialized();
    }

    /**
     * @inheritdoc ITokenModule
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) external virtual {
        OwnableStorage.onlyOwner();

        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function burn(address from, uint256 amount) external virtual override {
        OwnableStorage.onlyOwner();
        _burn(from, amount);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function mint(address to, uint256 amount) external virtual override {
        OwnableStorage.onlyOwner();
        _mint(to, amount);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function setAllowance(address from, address spender, uint256 amount) external virtual override {
        OwnableStorage.onlyOwner();
        ERC20Storage.load().allowance[from][spender] = amount;
    }

    function _isInitialized() internal view override returns (bool) {
        return Initialized.load(_INITIALIZED_NAME).initialized;
    }

    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal override {
        super._initialize(tokenName, tokenSymbol, tokenDecimals);
        Initialized.load(_INITIALIZED_NAME).initialized = true;
    }
}
