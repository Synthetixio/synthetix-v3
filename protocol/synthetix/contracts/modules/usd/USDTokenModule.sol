//SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "../../interfaces/IUSDTokenModule.sol";
import "../../storage/CrossChain.sol";

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";

/**
 * @title Module for managing the snxUSD token as an associated system.
 * @dev See IUSDTokenModule.
 */
contract USDTokenModule is ERC20, InitializableMixin, IUSDTokenModule {
    using AssociatedSystem for AssociatedSystem.Data;

    bytes32 private constant _CCIP_CHAINLINK_TOKEN_POOL = "ccipChainlinkTokenPool";

    /**
     * @dev For use as an associated system.
     */
    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }

    /**
     * @dev For use as an associated system.
     */
    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    /**
     * @dev For use as an associated system.
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public virtual {
        OwnableStorage.onlyOwner();
        _initialize(tokenName, tokenSymbol, tokenDecimals);
    }

    /**
     * @dev Allows the core system and CCIP to mint tokens.
     */
    function mint(address target, uint256 amount) external override {
        if (
            ERC2771Context._msgSender() != OwnableStorage.getOwner() &&
            ERC2771Context._msgSender() != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy
        ) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        _mint(target, amount);
    }

    /**
     * @dev Allows the core system and CCIP to burn tokens.
     */
    function burn(address target, uint256 amount) external override {
        if (
            ERC2771Context._msgSender() != OwnableStorage.getOwner() &&
            ERC2771Context._msgSender() != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy
        ) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        _burn(target, amount);
    }

    /**
     * @inheritdoc IUSDTokenModule
     */
    function burn(uint256 amount) external {
        if (
            ERC2771Context._msgSender() != OwnableStorage.getOwner() &&
            ERC2771Context._msgSender() != AssociatedSystem.load(_CCIP_CHAINLINK_TOKEN_POOL).proxy
        ) {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }

        _burn(ERC2771Context._msgSender(), amount);
    }

    /**
     * @inheritdoc IUSDTokenModule
     */
    function burnWithAllowance(address from, address spender, uint256 amount) external {
        OwnableStorage.onlyOwner();

        ERC20Storage.Data storage erc20 = ERC20Storage.load();

        if (amount > erc20.allowance[from][spender]) {
            revert InsufficientAllowance(amount, erc20.allowance[from][spender]);
        }

        erc20.allowance[from][spender] -= amount;

        _burn(from, amount);
    }

    /**
     * @dev Included to satisfy ITokenModule inheritance.
     */
    function setAllowance(address from, address spender, uint256 amount) external override {
        OwnableStorage.onlyOwner();
        ERC20Storage.load().allowance[from][spender] = amount;
    }
}
