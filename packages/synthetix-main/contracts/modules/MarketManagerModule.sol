//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../interfaces/IMarketManagerModule.sol";
import "../interfaces/IUSDToken.sol";
import "../storage/MarketManagerStorage.sol";

import "../mixins/MarketManagerMixin.sol";
import "../mixins/AccountRBACMixin.sol";
import "../mixins/FundMixin.sol";
import "../mixins/AssociatedSystemsMixin.sol";

contract MarketManagerModule is IMarketManagerModule, MarketManagerStorage, MarketManagerMixin, AssociatedSystemsMixin, OwnableMixin {
    error MarketAlreadyRegistered(address market);

    event MarketRegistered(address market, uint marketId);

    error NotEnoughLiquidity(uint marketId, uint amount);

    function registerMarket(address market) external override returns (uint marketId) {
        if (_marketManagerStore().marketIds[market] > 0) revert MarketAlreadyRegistered(market);
        uint lastMarketId = _marketManagerStore().lastMarketId++;
        marketId = lastMarketId + 1;

        _marketManagerStore().marketIds[market] = marketId;
        _marketManagerStore().markets[marketId].marketAddress = market;

        emit MarketRegistered(market, marketId);

        return marketId;
    }

    // function setSupplyTarget(
    //     uint marketId,
    //     uint fundId,
    //     uint amount // solhint-disable-next-line no-empty-blocks
    // ) external override {}

    // function supplyTarget(uint marketId) external view override returns (uint) {
    //     return _supplyTarget(marketId);
    // }

    // function _setLiquidity(
    //     uint marketId,
    //     uint fundId,
    //     uint amount // solhint-disable-next-line no-empty-blocks
    // ) internal {}

    function liquidity(uint marketId) external view override returns (uint) {
        return _availableLiquidity(marketId);
    }

    function fundBalance(uint marketId, uint fundId) external view override returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        return
            int((marketData.fundliquidityShares[fundId] / marketData.totalLiquidityShares)) *
            (_totalBalance(marketId) - marketData.fundInitialBalance[fundId]);
    }

    function totalBalance(uint marketId) external view override returns (int) {
        return _totalBalance(marketId);
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

        if (int(amount) > int(_availableLiquidity(marketId))) revert NotEnoughLiquidity(marketId, amount);

        // Adjust accounting
        marketData.issuance += int(amount);

        // mint some USD
        _getUSDToken().mint(target, amount);
    }

    function _availableLiquidity(uint marketId) internal view returns (uint) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (marketData.issuance > 0 && marketData.issuance >= int(marketData.totalDelegatedCollateralValue)) return 0;

        return uint(int(marketData.totalDelegatedCollateralValue) - marketData.issuance);
    }
}
