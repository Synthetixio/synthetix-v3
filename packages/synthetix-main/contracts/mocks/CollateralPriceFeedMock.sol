//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IPriceFeed.sol";

contract CollateralPriceFeedMock is IPriceFeed {
    uint256 private _price;

    function getCurrentPrice() external view override returns (uint) {
        return _price;
    }

    function setCurrentPrice(uint price) external {
        _price = price;
    }
}
