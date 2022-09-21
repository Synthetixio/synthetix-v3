//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "../interfaces/external/IMarket.sol";
import "../interfaces/IMarketManagerModule.sol";
import "../interfaces/IMarketCollateralModule.sol";

contract MockMarket is IMarket {
    using MathUtil for uint256;

    uint private _reportedDebt;
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
        _reportedDebt += amount;
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).depositUsd(_marketId, msg.sender, toDeposit);
    }

    function sellSynth(uint amount) external {
        _reportedDebt -= amount;
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).withdrawUsd(_marketId, msg.sender, toDeposit);
    }

    function setReportedDebt(uint newReportedDebt) external {
        _reportedDebt = newReportedDebt;
    }

    function reportedDebt() external view override returns (uint) {
        return _reportedDebt;
    }

    function setPrice(uint newPrice) external {
        _price = newPrice;
    }

    function price() external view returns (uint) {
        return _price;
    }

    function depositCollateral(address collateralType, uint amount) external {
        IERC20(collateralType).transferFrom(msg.sender, address(this), amount);
        IERC20(collateralType).approve(_proxy, amount);
        IMarketCollateralModule(_proxy).depositMarketCollateral(_marketId, collateralType, amount);
    }

    function withdrawCollateral(address collateralType, uint amount) external {
        IMarketCollateralModule(_proxy).withdrawMarketCollateral(_marketId, collateralType, amount);
        IERC20(collateralType).transfer(msg.sender, amount);
    }
}
