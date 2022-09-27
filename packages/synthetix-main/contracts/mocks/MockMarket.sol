//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "../interfaces/external/IMarket.sol";
import "../interfaces/IMarketManagerModule.sol";
import "../interfaces/IAssociateDebtModule.sol";

contract MockMarket is IMarket {
    using MathUtil for uint256;

    uint private _balance;
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

    function callAssociateDebt(
        uint poolId,
        address collateralType,
        uint accountId,
        uint amount
    ) external {
        _balance += amount;

        IAssociateDebtModule(_proxy).associateDebt(_marketId, poolId, collateralType, accountId, amount);
    }

    function buySynth(uint amount) external {
        _balance += amount;
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).depositUsd(_marketId, msg.sender, toDeposit);
    }

    function sellSynth(uint amount) external {
        _balance -= amount;
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).withdrawUsd(_marketId, msg.sender, toDeposit);
    }

    function setBalance(uint newBalance) external {
        _balance = newBalance;
    }

    function balance() external view override returns (uint) {
        return _balance;
    }

    function setPrice(uint newPrice) external {
        _price = newPrice;
    }

    function price() external view returns (uint) {
        return _price;
    }
}
