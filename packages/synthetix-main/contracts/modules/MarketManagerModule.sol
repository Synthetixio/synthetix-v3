//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
// import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

// import "../submodules/FundEventAndErrors.sol";
import "../interfaces/IMarketManagerModule.sol";
import "../interfaces/IMarket.sol";
import "../interfaces/IUSDToken.sol";
import "../storage/MarketManagerStorage.sol";
import "../mixins/SharesLibrary.sol";

import "../mixins/AccountRBACMixin.sol";
import "../mixins/FundMixin.sol";
import "../mixins/USDMixin.sol";

contract MarketManagerModule is IMarketManagerModule, MarketManagerStorage, USDMixin, OwnableMixin {
    function registerMarket(address market) external override returns (uint) {}

    function setSupplyTarget(
        uint marketId,
        uint fundId,
        uint amount
    ) external override {}

    function supplyTarget(uint marketId) public view override returns (uint) {
        return uint(int(_marketManagerStore().markets[marketId].delegatedCollateralValue) + totalBalance(marketId));
    }

    function _rebalanceMarket(
        uint marketId,
        uint fundId,
        uint amount
    ) internal {
        // called by the fund at rebalance markets
        //       mapping(uint => uint) fundliquidityShares;
        // mapping(uint => int) fundInitialBalance;

        MarketData storage marketData = _marketManagerStore().markets[marketId];
        int currentFundBalance = fundBalance(marketId, fundId);
        uint currentSupplyTarget = supplyTarget(marketId); // cannot be negative, if so, revert.

        marketData.fundliquidityShares[fundId] = SharesLibrary.amountToShares(
            marketData.totalLiquidityShares,
            currentSupplyTarget,
            amount
        );
    }

    function _setLiquidity(
        uint marketId,
        uint fundId,
        uint amount
    ) internal {}

    function liquidity(uint marketId) public view override returns (uint) {
        return _availableLiquidity(marketId);
    }

    function fundBalance(uint marketId, uint fundId) public view override returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        return
            int((marketData.fundliquidityShares[fundId] / marketData.totalLiquidityShares)) *
            (totalBalance(marketId) - marketData.fundInitialBalance[fundId]);
    }

    function totalBalance(uint marketId) public view override returns (int) {
        return
            IMarket(_marketManagerStore().markets[marketId].marketAddress).balance() +
            _marketManagerStore().markets[marketId].issuance;
    }

    // deposit will burn USD
    function deposit(
        uint marketId,
        address target,
        uint amount
    ) external override {
        // Consider re-implementing without allowance and just USD.transferFrom(msg.sender);

        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        // verify if the market is authorized to burn the USD for the target
        uint originalAllowance = _getUSDToken().allowance(target, msg.sender);
        require(originalAllowance >= amount, "insufficient allowance");

        // Adjust accounting
        marketData.issuance -= int(amount);

        // burn USD
        _getUSDToken().burn(target, amount);

        // Adjust allowance
        _getUSDToken().setAllowance(target, msg.sender, originalAllowance - amount);
    }

    // withdraw will mint USD
    function withdraw(
        uint marketId,
        address target,
        uint amount
    ) external override {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        require(marketData.issuance + int(amount) <= int(_availableLiquidity(marketId)), "some error");

        // Adjust accounting
        marketData.issuance += int(amount);

        // mint some USD
        _getUSDToken().mint(target, amount);
    }

    function _availableLiquidity(uint marketId) internal view returns (uint) {
        return 0;
    }
}
