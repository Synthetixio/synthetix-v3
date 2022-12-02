//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";

import "../../interfaces/IMarketManagerModule.sol";
import "../../interfaces/IUSDTokenModule.sol";

import "../../storage/Market.sol";
import "../../storage/MarketCreator.sol";
import "../../storage/Account.sol";

import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title TODO
 */
contract MarketManagerModule is IMarketManagerModule {
    using SafeCastU128 for uint128;
    using SafeCastU256 for uint256;
    using SafeCastI128 for int128;
    using SafeCastI256 for int256;
    using Market for Market.Data;
    using AssociatedSystem for AssociatedSystem.Data;

    bytes32 private constant _USD_TOKEN = "USDToken";
    bytes32 private constant _MARKET_FEATURE_FLAG = "registerMarket";

    error NotEnoughLiquidity(uint128 marketId, uint amount);

    /**
     * @dev Connects an external market to the system.
     *
     * Creates a Market object to track the external market, and returns the newly crated market id.
     */
    function registerMarket(address market) external override returns (uint128 marketId) {
        FeatureFlag.ensureAccessToFeature(_MARKET_FEATURE_FLAG);

        // TODO: Do we want to do this?
        // Can we verify that `market` conforms to the IMarket interface here? (i.e. has a `balance()` function?)

        marketId = MarketCreator.create(market).id;

        emit MarketRegistered(market, marketId);

        return marketId;
    }

    /**
     * @dev Returns the total withdrawable USD amount for the specified market.
     */
    function getWithdrawableUsd(uint128 marketId) public view override returns (uint) {
        return Market.load(marketId).creditCapacityD18 + Market.load(marketId).getDepositedCollateralValue();
    }

    /**
     * @dev Returns the net issuance of the specified market.
     */
    function getMarketNetIssuance(uint128 marketId) external view override returns (int128) {
        return Market.load(marketId).netIssuanceD18;
    }

    /**
     * @dev Returns the reported debt of the specified market.
     */
    function getMarketReportedDebt(uint128 marketId) external view override returns (uint) {
        return Market.load(marketId).getReportedDebt();
    }

    /**
     * @dev Returns the total collateral for the specified market.
     */
    function getMarketCollateral(uint128 marketId) external view override returns (uint) {
        return Market.load(marketId).poolsDebtDistribution.totalSharesD18;
    }

    /**
     * @dev Returns the total debt of the specified market.
     */
    function getMarketTotalDebt(uint128 marketId) external view override returns (int) {
        return Market.load(marketId).totalDebt();
    }

    function getMarketDebtPerShare(uint128 marketId) external override returns (int) {
        Market.Data storage market = Market.load(marketId);

        market.distributeDebtToPools(999999999);

        return market.getDebtPerShare();
    }

    function isMarketCapacityLocked(uint128 marketId) external view override returns (bool) {
        return Market.load(marketId).isCapacityLocked();
    }

    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external override {
        Market.Data storage market = Market.load(marketId);

        if (msg.sender != market.marketAddress) revert AccessError.Unauthorized(msg.sender);

        // verify if the market is authorized to burn the USD for the target
        ITokenModule usdToken = AssociatedSystem.load(_USD_TOKEN).asToken();

        // Adjust accounting
        market.creditCapacityD18 += amount.to128();
        market.netIssuanceD18 -= amount.toInt().to128();

        // burn USD
        IUSDTokenModule(address(usdToken)).burnWithAllowance(target, msg.sender, amount);

        emit MarketUsdDeposited(marketId, target, amount, msg.sender);
    }

    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external override {
        Market.Data storage marketData = Market.load(marketId);

        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        if (amount > getWithdrawableUsd(marketId)) revert NotEnoughLiquidity(marketId, amount);

        // Adjust accounting
        marketData.creditCapacityD18 -= amount.to128();
        marketData.netIssuanceD18 += amount.toInt().to128();

        // mint some USD
        AssociatedSystem.load(_USD_TOKEN).asToken().mint(target, amount);

        emit MarketUsdWithdrawn(marketId, target, amount, msg.sender);
    }
}
