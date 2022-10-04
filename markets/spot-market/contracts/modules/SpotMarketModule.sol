//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "../interfaces/ISpotMarket.sol";
import "../interfaces/external/IMarketFee.sol";
import "../storage/SpotMarketStorage.sol";

contract SpotMarketModule is ISpotMarket, SpotMarketStorage, ERC20, OwnableMixin, InitializableMixin {
    using MathUtil for uint256;

    error InsufficientFunds();
    error IncorrectMarket();

    function _isInitialized() internal view override returns (bool) {
        return _spotMarketStore().initialized;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        address snxAddress,
        address usdTokenAddress,
        string memory name,
        string memory symbol,
        uint8 decimals,
        address priceFeed,
        address feeManager
    ) external override onlyOwner {
        SpotMarketStore storage store = _spotMarketStore();
        // initialize token
        _initialize(name, symbol, decimals);

        store.synthetix = snxAddress;
        store.usdToken = ITokenModule(usdTokenAddress);
        // register with market manager
        uint synthMarketId = IMarketManagerModule(store.synthetix).registerMarket(address(this));
        // set storage
        store.marketId = synthMarketId;
        store.feeManager = feeManager;
        store.priceFeed = priceFeed;
        // emit event
        emit SynthRegistered(synthMarketId);
        // we're initialized
        store.initialized = true;
    }

    /* should this accept marketId as a param */
    function reportedDebt(uint marketId) external view override returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();
        if (store.marketId != marketId) {
            revert IncorrectMarket();
        }

        return totalSupply().mulDecimal(_getCurrentPrice());
    }

    function updateFeeManager(address newFeeManager) external override onlyOwner {
        _spotMarketStore().feeManager = newFeeManager;
    }

    function buy(uint amountUsd) external override onlyIfInitialized returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        if (store.usdToken.balanceOf(msg.sender) < amountUsd) {
            revert InsufficientFunds();
        }
        if (store.usdToken.allowance(msg.sender, address(this)) < amountUsd) {
            revert InsufficientAllowance(amountUsd, store.usdToken.allowance(msg.sender, address(this)));
        }

        store.usdToken.transferFrom(msg.sender, address(this), amountUsd);
        (uint amountUsable, uint feesCollected) = _manageFees(store, amountUsd);

        uint amountToMint = _usdSynthExchangeRate(amountUsable);
        _mint(msg.sender, amountToMint);

        // check with db on market manager to check for msg sender being the target
        store.usdToken.approve(address(this), amountUsable); // required for market manager
        IMarketManagerModule(store.synthetix).depositUsd(store.marketId, address(this), amountUsable);

        emit SynthBought(store.marketId, amountToMint, feesCollected);

        return amountToMint;
    }

    function sell(uint sellAmount) external override onlyIfInitialized returns (uint) {
        SpotMarketStore storage store = _spotMarketStore();

        uint amountToWithdraw = _synthUsdExchangeRate(sellAmount);
        _burn(msg.sender, sellAmount);

        IMarketManagerModule(store.synthetix).withdrawUsd(store.marketId, address(this), amountToWithdraw);
        (uint returnAmount, uint feesCollected) = _manageFees(store, amountToWithdraw);

        store.usdToken.transfer(msg.sender, returnAmount);
        emit SynthSold(store.marketId, returnAmount, feesCollected);

        return returnAmount;
    }

    // TODO: change from pure once _getCurrentPrice is implemented
    function _synthUsdExchangeRate(uint sellAmount) internal pure returns (uint amountUsd) {
        uint currentPrice = _getCurrentPrice();
        amountUsd = sellAmount.mulDecimal(currentPrice);
    }

    function _usdSynthExchangeRate(uint amountUsd) internal pure returns (uint synthAmount) {
        uint currentPrice = _getCurrentPrice();
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function _manageFees(SpotMarketStore storage store, uint amountUsd) internal returns (uint, uint) {
        store.usdToken.approve(store.feeManager, amountUsd);
        return IMarketFee(store.feeManager).processFees(msg.sender, store.marketId, amountUsd);
    }

    // TODO: interact with OracleManager to get price for market synth
    function _getCurrentPrice() internal pure returns (uint) {
        /* get from oracleManager / aggregator chainlink based on synth id */
        return 1;
    }
}
