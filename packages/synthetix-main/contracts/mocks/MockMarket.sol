//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "../interfaces/external/IMarket.sol";
import "../interfaces/IMarketManagerModule.sol";

contract MockMarket is IMarket {
    using MathUtil for uint256;

    int private _balance;
    uint private _price;

    address private _proxy;
    uint private _marketId;

    function initialize(
        address proxy,
        uint marketId,
        uint initialPrice
    ) external {
        _proxy = proxy;
        _marketId = marketId;
        _price = initialPrice;
    }

    function buySynth(uint amount) external {
        _balance -= int(amount);
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).deposit(_marketId, msg.sender, toDeposit);
    }

    function sellSynth(uint amount) external {
        _balance += int(amount);
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).withdraw(_marketId, msg.sender, toDeposit);
    }

    function setBalance(int newBalance) external {
        _balance = newBalance;
    }

    function balance() external view override returns (int) {
        return _balance;
    }

    function setPrice(uint newPrice) external {
        _price = newPrice;
    }

    function price() external view returns (uint) {
        return _price;
    }
}
