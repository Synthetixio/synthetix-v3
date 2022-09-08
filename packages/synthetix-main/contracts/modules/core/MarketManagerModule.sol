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

    modifier onlyMarket(uint marketId) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (msg.sender != marketData.marketAddress) {
            revert AccessError.Unauthorized(msg.sender);
        }

        _;
    }

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
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        return marketData.capacity;
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
    ) external override onlyMarket(marketId) {
        address market = msg.sender;

        MarketData storage marketData = _marketManagerStore().markets[marketId];

        ITokenModule usdToken = _getToken(_USD_TOKEN);

        // Verify that the market has allowance to spend the user's snxUSD
        uint originalAllowance = usdToken.allowance(target, market);
        if (originalAllowance < amount) {
            revert MarketDepositNotApproved(target, market, amount, originalAllowance);
        }

        // Adjust accounting
        marketData.capacity += uint128(amount);
        marketData.issuance -= int128(int(amount));

        // Burn the user's snxUSD
        // Note: The market manager could transfer the snxUSD to itself,
        // but burning it has the additional benefit of completely taking it out of circulation
        usdToken.burn(target, amount);

        // Reduce the market's allowance on the user's snxUSD
        usdToken.setAllowance(target, market, originalAllowance - amount);

        emit UsdDeposited(marketId, target, amount, market);
    }

    function withdrawUsd(
        uint marketId,
        address target,
        uint amount
    ) external override onlyMarket(marketId) {
        MarketData storage marketData = _marketManagerStore().markets[marketId];

        if (amount > marketData.capacity) revert NotEnoughLiquidity(marketId, amount);

        // Adjust accounting
        marketData.capacity -= uint128(amount);
        marketData.issuance += int128(int(amount));

        // mint some USD
        _getToken(_USD_TOKEN).mint(target, amount);

        emit UsdWithdrawn(marketId, target, amount, msg.sender);
    }
}
