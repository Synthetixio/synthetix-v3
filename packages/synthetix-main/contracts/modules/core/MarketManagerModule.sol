//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../../interfaces/IMarketManagerModule.sol";
import "../../interfaces/IUSDTokenModule.sol";
import "../../interfaces/external/IMarket.sol";

import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";

import "../../storage/Market.sol";
import "../../storage/MarketCreator.sol";
import "../../storage/Account.sol";

import "@synthetixio/core-modules/contracts/storage/AssociatedSystem.sol";
import "@synthetixio/core-modules/contracts/storage/FeatureFlag.sol";

/**
 * @title System-wide entry point for the management of markets connected to the system.
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
    error IncorrectMarketInterface(address market);

    /**
     * @dev Connects an external market to the system.
     *
     * Creates a Market object to track the external market, and returns the newly crated market id.
     */
    function registerMarket(address market) external override returns (uint128 marketId) {
        FeatureFlag.ensureAccessToFeature(_MARKET_FEATURE_FLAG);

        if (!IMarket(market).supportsInterface(type(IMarket).interfaceId)) {
            revert IncorrectMarketInterface(market);
        }

        marketId = MarketCreator.create(market).id;

        emit MarketRegistered(market, marketId, msg.sender);

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

    /**
     * @dev Returns the value per share of the debt of the specified market.
     *
     * Note: This is not a view function, and actually updates the entire debt distribution chain.
     * To call this externally as a view function, use `staticall`.
     */
    function getMarketDebtPerShare(uint128 marketId) external override returns (int) {
        Market.Data storage market = Market.load(marketId);

        market.distributeDebtToPools(999999999);

        return market.getDebtPerShare();
    }

    /**
     * @dev Returns wether the capacity of the specified market is locked.
     */
    function isMarketCapacityLocked(uint128 marketId) external view override returns (bool) {
        return Market.load(marketId).isCapacityLocked();
    }

    /**
     * @dev Allows an external market connected to the system to deposit USD in the system.
     *
     * The system burns the incoming USD, increases the market's credit capacity, and reduces its issuance.
     *
     * See `IMarket`.
     */
    function depositMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external override {
        Market.Data storage market = Market.load(marketId);

        // Call must come from the market itself.
        if (msg.sender != market.marketAddress) revert AccessError.Unauthorized(msg.sender);

        // verify if the market is authorized to burn the USD for the target
        ITokenModule usdToken = AssociatedSystem.load(_USD_TOKEN).asToken();

        // Adjust accounting.
        market.creditCapacityD18 += amount.to128();
        market.netIssuanceD18 -= amount.toInt().to128();

        // Burn the incoming USD.
        // Note: Instead of burning, we could transfer USD to and from the MarketManager,
        // but minting and burning takes the USD out of circulation,
        // which doesn't affect `totalSupply`, thus simplifying accounting.
        IUSDTokenModule(address(usdToken)).burnWithAllowance(target, msg.sender, amount);

        emit MarketUsdDeposited(marketId, target, amount, msg.sender);
    }

    /**
     * @dev Allows an external market connected to the system to withdraw USD from the system.
     *
     * The system mints the requested USD (provided that the market's USD balance allows it),
     * reduces the market's credit capacity, and increases its issuance.
     *
     * See `IMarket`.
     */
    function withdrawMarketUsd(
        uint128 marketId,
        address target,
        uint amount
    ) external override {
        Market.Data storage marketData = Market.load(marketId);

        // Call must come from the market itself.
        if (msg.sender != marketData.marketAddress) revert AccessError.Unauthorized(msg.sender);

        // Ensure that the market's balance allows for this withdrawal.
        if (amount > getWithdrawableUsd(marketId)) revert NotEnoughLiquidity(marketId, amount);

        // Adjust accounting.
        marketData.creditCapacityD18 -= amount.to128();
        marketData.netIssuanceD18 += amount.toInt().to128();

        // Mint the requested USD.
        AssociatedSystem.load(_USD_TOKEN).asToken().mint(target, amount);

        emit MarketUsdWithdrawn(marketId, target, amount, msg.sender);
    }
}
