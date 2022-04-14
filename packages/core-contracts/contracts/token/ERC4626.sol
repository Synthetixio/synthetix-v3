//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC4626.sol";
import "../interfaces/IERC20.sol";
import "./ERC20.sol";
import "./ERC4626Storage.sol";

/*
    Reference implementations:
    * Rari - https://github.com/Rari-Capital/solmate/blob/main/src/mixins/ERC4626.sol
    * Vyper - https://github.com/fubuloubu/ERC4626
*/

contract ERC4626 is IERC4626, ERC20, ERC4626Storage {
    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    function _initialize(
        address assetAddress,
        string memory tokenName,
        string memory tokenSymbol
    ) internal virtual {
        ERC20._initialize(tokenName, tokenSymbol, IERC20(assetAddress).decimals());

        _erc4626Store().assetAddress = assetAddress;
    }

    function asset() external view override returns (address) {
        return _erc4626Store().assetAddress;
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(_erc4626Store().assetAddress).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        // solhint-disable-next-line private-vars-leading-underscore
        uint256 _totalSupply = totalSupply();
        // solhint-disable-next-line private-vars-leading-underscore
        uint256 _totalAssets = totalAssets();
        if (_totalAssets == 0 || _totalSupply == 0) return assets;
        return (assets * _totalSupply) / _totalAssets;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        // solhint-disable-next-line private-vars-leading-underscore
        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) return 0;
        return (shares * totalAssets()) / _totalSupply;
    }

    function maxDeposit(address receiver) external view virtual override returns (uint256) {
        return type(uint256).max;
    }

    function previewDeposit(uint256 assets) external view override returns (uint256) {
        return convertToShares(assets);
    }

    function deposit(uint256 assets, address receiver) external override returns (uint256) {
        uint256 shares = convertToShares(assets);
        IERC20(_erc4626Store().assetAddress).transferFrom(msg.sender, address(this), assets);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);

        return shares;
    }

    function maxMint(address receiver) external view override returns (uint256) {
        return type(uint256).max;
    }

    function previewMint(uint256 shares) external view override returns (uint256) {
        uint256 assets = convertToAssets(shares);
        if (assets == 0 && totalAssets() == 0) return shares;
        return assets;
    }

    function mint(uint256 shares, address receiver) external override returns (uint256) {
        uint256 assets = convertToAssets(shares);

        if (totalAssets() == 0) assets = shares;

        IERC20(_erc4626Store().assetAddress).transferFrom(msg.sender, address(this), assets);

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, assets, shares);

        return assets;
    }

    function maxWithdraw(address owner) external view override returns (uint256) {
        return type(uint256).max;
    }

    function previewWithdraw(uint256 assets) external view override returns (uint256) {
        uint256 shares = convertToShares(assets);
        if (totalSupply() == 0) return 0;
        return shares;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256) {
        uint256 shares = convertToShares(assets);

        _burn(owner, shares);

        IERC20(_erc4626Store().assetAddress).transfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        return shares;
    }

    function maxRedeem(address owner) external view override returns (uint256) {
        return type(uint256).max;
    }

    function previewRedeem(uint256 shares) external view override returns (uint256) {
        return convertToAssets(shares);
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256) {
        uint256 assets = convertToAssets(shares);

        _burn(owner, shares);

        IERC20(_erc4626Store().assetAddress).transfer(receiver, assets);
        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        return assets;
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL HOOKS LOGIC
    //////////////////////////////////////////////////////////////*/

    function _beforeWithdraw(uint256 assets, uint256 shares) internal virtual {}

    function _afterDeposit(uint256 assets, uint256 shares) internal virtual {}
}
