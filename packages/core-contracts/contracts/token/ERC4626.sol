//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC4626.sol";
import "../interfaces/IERC20.sol";
import "../utils/MathUtil.sol";
import "./ERC20.sol";
import "./ERC4626Storage.sol";

/*
    Reference implementations:
    * Rari - https://github.com/Rari-Capital/solmate/blob/main/src/mixins/ERC4626.sol
    * Vyper - https://github.com/fubuloubu/ERC4626
*/

contract ERC4626 is IERC4626, ERC20, ERC4626Storage {
    using MathUtil for uint256;

    event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    error ZeroShares(uint256 assets, address sender, address receiver);
    error ZeroAssets(uint256 shares, address sender, address receiver, address owner);

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

    function deposit(uint256 assets, address receiver) external override returns (uint256) {
        uint256 shares = previewDeposit(assets);

        // Check for rounding error since we round down in previewDeposit.
        if (shares == 0) {
            revert ZeroShares(assets, msg.sender, receiver);
        }

        IERC20(_erc4626Store().assetAddress).transferFrom(msg.sender, address(this), assets);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);

        _afterDeposit(assets, shares);

        return shares;
    }

    function mint(uint256 shares, address receiver) external override returns (uint256) {
        uint256 assets = previewMint(shares); // No need to check for rounding error, previewMint rounds up.

        IERC20(_erc4626Store().assetAddress).transferFrom(msg.sender, address(this), assets);

        _mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);

        _afterDeposit(assets, shares);

        return assets;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external override returns (uint256) {
        uint256 shares = previewWithdraw(assets); // No need to check for rounding error, previewWithdraw rounds up.

        _beforeWithdraw(assets, shares);

        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        IERC20(_erc4626Store().assetAddress).transfer(receiver, assets);

        return shares;
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external override returns (uint256) {
        uint256 assets = previewRedeem(shares);

        // Check for rounding error since we round down in previewRedeem.
        if (assets == 0) {
            revert ZeroAssets(shares, msg.sender, receiver, owner);
        }

        _beforeWithdraw(assets, shares);

        _burn(owner, shares);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        IERC20(_erc4626Store().assetAddress).transfer(receiver, assets);

        return assets;
    }

    /*//////////////////////////////////////////////////////////////
                    ACCOUNTING LOGIC
    //////////////////////////////////////////////////////////////*/

    function totalAssets() public view override returns (uint256) {
        return IERC20(_erc4626Store().assetAddress).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        uint256 supply = totalSupply(); // Saves an extra SLOAD if totalSupply is non-zero.

        return supply == 0 ? assets : assets.mulDivDown(supply, totalAssets());
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        uint256 supply = totalSupply(); // Saves an extra SLOAD if totalSupply is non-zero.

        return supply == 0 ? shares : shares.mulDivDown(totalAssets(), supply);
    }

    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return convertToShares(assets);
    }

    function previewMint(uint256 shares) public view override returns (uint256) {
        uint256 supply = totalSupply(); // Saves an extra SLOAD if totalSupply is non-zero.

        return supply == 0 ? shares : shares.mulDivUp(totalAssets(), supply);
    }

    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        uint256 supply = totalSupply(); // Saves an extra SLOAD if totalSupply is non-zero.

        return supply == 0 ? assets : assets.mulDivUp(supply, totalAssets());
    }

    function previewRedeem(uint256 shares) public view override returns (uint256) {
        return convertToAssets(shares);
    }

    function maxDeposit(address receiver) external view virtual override returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address receiver) external pure override returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) external pure override returns (uint256) {
        return type(uint256).max;
    }

    function maxRedeem(address owner) external pure override returns (uint256) {
        return type(uint256).max;
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL HOOKS LOGIC
    //////////////////////////////////////////////////////////////*/

    // solhint-disable-next-line no-empty-blocks
    function _beforeWithdraw(uint256 assets, uint256 shares) internal virtual {}

    // solhint-disable-next-line no-empty-blocks
    function _afterDeposit(uint256 assets, uint256 shares) internal virtual {}
}
