//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/interfaces/IERC20.sol";
import "../interfaces/external/IMarket.sol";
import "../interfaces/IMarketManagerModule.sol";
import "../interfaces/IAssociateDebtModule.sol";
import "../interfaces/IMarketCollateralModule.sol";

contract MockMarket is IMarket {
    using DecimalMath for uint256;

    uint private _reportedDebt;
    uint private _locked;
    uint private _price;

    address private _proxy;
    uint128 private _marketId;

    function initialize(address proxy, uint128 marketId, uint initialPrice) external {
        _proxy = proxy;
        _marketId = marketId;
        _price = initialPrice;
    }

    function callAssociateDebt(
        uint128 poolId,
        address collateralType,
        uint128 accountId,
        uint amount
    ) external {
        IAssociateDebtModule(_proxy).associateDebt(
            _marketId,
            poolId,
            collateralType,
            accountId,
            amount
        );
    }

    function buySynth(uint amount) external {
        _reportedDebt += amount;
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).depositMarketUsd(_marketId, msg.sender, toDeposit);
    }

    function sellSynth(uint amount) external {
        _reportedDebt -= amount;
        uint toDeposit = amount.divDecimal(_price);
        IMarketManagerModule(_proxy).withdrawMarketUsd(_marketId, msg.sender, toDeposit);
    }

    function setReportedDebt(uint newReportedDebt) external {
        _reportedDebt = newReportedDebt;
    }

    function setLocked(uint newLocked) external {
        _locked = newLocked;
    }

    function reportedDebt(uint128) external view override returns (uint) {
        return _reportedDebt;
    }

    function name(uint128) external pure override returns (string memory) {
        return "MockMarket";
    }

    function locked(uint128) external view override returns (uint) {
        return _locked;
    }

    function setPrice(uint newPrice) external {
        _price = newPrice;
    }

    function price() external view returns (uint) {
        return _price;
    }

    function deposit(address collateralType, uint amount) external {
        IERC20(collateralType).transferFrom(msg.sender, address(this), amount);
        IERC20(collateralType).approve(_proxy, amount);
        IMarketCollateralModule(_proxy).depositMarketCollateral(_marketId, collateralType, amount);
    }

    function withdraw(address collateralType, uint amount) external {
        IMarketCollateralModule(_proxy).withdrawMarketCollateral(_marketId, collateralType, amount);
        IERC20(collateralType).transfer(msg.sender, amount);
    }

    function name(uint) external pure returns (string memory) {
        return "Mock Market";
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(IERC165) returns (bool) {
        return
            interfaceId == type(IMarket).interfaceId ||
            interfaceId == this.supportsInterface.selector;
    }
}
