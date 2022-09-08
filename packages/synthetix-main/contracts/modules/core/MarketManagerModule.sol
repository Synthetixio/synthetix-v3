//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../../interfaces/IMarketManagerModule.sol";
import "../../interfaces/IUSDTokenModule.sol";
import "../../storage/MarketManagerStorage.sol";

import "@synthetixio/core-modules/contracts/mixins/AssociatedSystemsMixin.sol";
import "../../mixins/MarketManagerMixin.sol";
import "../../mixins/AccountRBACMixin.sol";
import "../../mixins/PoolMixin.sol";

contract MarketManagerModule is
    IMarketManagerModule,
    MarketManagerStorage,
    MarketManagerMixin,
    AssociatedSystemsMixin,
    OwnableMixin
{
    bytes32 private constant _USD_TOKEN = "USDToken";

    error MarketAlreadyRegistered(address market, uint existingMarketId);
    error NotEnoughLiquidity(uint marketId, uint amount);
    error MarketDepositNotApproved(address market, address from, uint requestedAmount, uint approvedAmount);

    function registerMarket(address marketAddress) external override returns (uint marketId) {
        MarketManagerStore storage store = _marketManagerStore();

        marketId = store.marketIds[marketAddress];

        if (marketId > 0) {
            revert MarketAlreadyRegistered(marketAddress, marketId);
        }

        // Read the lastMarketId from storage, and increment 1,
        // both locally and in the store
        uint lastMarketId = store.lastMarketId++;
        marketId = lastMarketId + 1;

        // TODO: Can we verify that `market` conforms to the IMarket interface here?
        // (i.e. has a `balance()` function?)

        store.marketIds[marketAddress] = marketId;
        store.markets[marketId].marketAddress = marketAddress;

        emit MarketRegistered(marketAddress, marketId);

        return marketId;
    }

    function getWithdrawableUsd(uint marketId) external view override returns (uint) {
        return _marketManagerStore().markets[marketId].capacity;
    }

    function getMarketIssuance(uint marketId) external view override returns (int128) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        return marketData.issuance;
    }

    function getMarketReportedBalance(uint marketId) external view override returns (uint) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        return _getReportedBalance(marketData);
    }

    function getMarketCollateral(uint marketId) external view override returns (uint) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        return marketData.debtDist.totalShares;
    }

    function getMarketTotalBalance(uint marketId) external view override returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        return _totalBalance(marketData);
    }

    function getMarketDebtPerShare(uint marketId) external override returns (int) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];
        _distributeMarket(marketData, 999999999);

        return marketData.debtDist.valuePerShare / 1e9;
    }

    function depositUsd(
        uint marketId,
        address target,
        uint amount
    ) external override {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        // verify if the market is authorized to burn the USD for the target
        ITokenModule usdToken = _getToken(_USD_TOKEN);

        uint originalAllowance = usdToken.allowance(target, msg.sender);

        if (originalAllowance < amount) {
            revert MarketDepositNotApproved(target, msg.sender, amount, originalAllowance);
        }

        // Adjust accounting
        marketData.capacity += uint128(amount);
        marketData.issuance -= int128(int(amount));

        // burn USD
        usdToken.burn(target, amount);

        // Adjust allowance
        usdToken.setAllowance(target, msg.sender, originalAllowance - amount);

        emit UsdDeposited(marketId, target, amount, msg.sender);
    }

    function withdrawUsd(
        uint marketId,
        address target,
        uint amount
    ) external override {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        if (amount > marketData.capacity) revert NotEnoughLiquidity(marketId, amount);

        // Adjust accounting
        marketData.capacity -= uint128(amount);
        marketData.issuance += int128(int(amount));

        // mint some USD
        _getToken(_USD_TOKEN).mint(target, amount);

        emit UsdWithdrawn(marketId, target, amount, msg.sender);
    }
}
