//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {Math} from "./ERC4626/Math.sol";

contract ERC4626Mock {
    using Math for uint256;

    address public asset;

    constructor(address _asset) {
        asset = _asset;
    }

    function decimals() external pure returns (uint8) {
        return 6;
    }

    function totalAssets() public pure returns (uint256) {
        return 120000000;
    }

    function totalSupply() public pure returns (uint256) {
        return 200000000;
    }

    function convertToAssets(uint256 shares) public view virtual returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    function _convertToAssets(
        uint256 shares,
        Math.Rounding rounding
    ) internal view virtual returns (uint256) {
        return shares.mulDiv(totalAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), rounding);
    }

    function _decimalsOffset() internal view returns (uint8) {
        return 0;
    }
}
