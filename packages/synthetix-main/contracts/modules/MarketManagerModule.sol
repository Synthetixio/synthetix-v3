//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
// import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

// import "../submodules/FundEventAndErrors.sol";
import "../interfaces/IMarketManagerModule.sol";
import "../interfaces/IMarket.sol";
import "../interfaces/ISUSDToken.sol";
import "../storage/MarketManagerStorage.sol";

import "../mixins/AccountRBACMixin.sol";
import "../mixins/FundMixin.sol";
import "../mixins/sUSDMixin.sol";

contract MarketManagerModule is IMarketManagerModule, MarketManagerStorage, SUSDMixin, OwnableMixin {
    function registerMarket(address market) external override returns (uint) {}

    function setSupplyTarget(
        uint marketId,
        uint fundId,
        uint amount
    ) external override {}

    function supplyTarget(uint marketId) external override returns (uint) {}

    function _setLiquidity(
        uint marketId,
        uint fundId,
        uint amount
    ) internal {}

    function liquidity(uint marketId) public override returns (uint) {
        return _marketManagerStore().markets[marketId].availableLiquidity;
    }

    function fundBalance(uint marketId, uint fundId) external override returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        return
            int((marketData.fundliquidityShares[fundId] / marketData.totalLiquidityShares)) *
            (totalBalance(marketId) - marketData.fundInitialBalance[fundId]);
    }

    function totalBalance(uint marketId) public override returns (int) {
        return
            IMarket(_marketManagerStore().markets[marketId].marketAddress).balance() +
            _marketManagerStore().markets[marketId].issuance;
    }

    // deposit will burn sUSD
    function deposit(
        uint marketId,
        address target,
        uint amount
    ) external override {
        // Consider re-implementing without allowance and just sUsd.transferFrom(msg.sender);

        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        // verify if the market is authorized to burn the sUSD for the target
        uint originalAllowance = _getSUSDToken().allowance(target, msg.sender);
        require(originalAllowance >= amount, "insufficient allowance");

        // Adjust accounting
        marketData.issuance -= int(amount);

        // burn sUSD
        _getSUSDToken().burn(target, amount);

        // Adjust allowance
        _getSUSDToken().setAllowance(target, msg.sender, originalAllowance - amount);
    }

    // withdraw will mint sUSD
    function withdraw(
        uint marketId,
        address target,
        uint amount
    ) external override {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        require(marketData.issuance + int(amount) <= int(marketData.availableLiquidity), "some error");

        // Adjust accounting
        marketData.issuance += int(amount);

        // mint some sUSD
        _getSUSDToken().mint(target, amount);
    }
}
