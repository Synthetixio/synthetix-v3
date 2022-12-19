//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/oracle-manager/contracts/interfaces/IOracleManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "./SpotMarketFactory.sol";
import "../utils/SynthUtil.sol";
import "./Fee.sol";
import "./Wrapper.sol";

library Price {
    using DecimalMath for int256;
    using DecimalMath for uint256;
    using SafeCastI256 for int256;
    using SafeCastU256 for uint256;

    struct Data {
        bytes32 buyFeedId;
        bytes32 sellFeedId;
        uint skewScale;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Price", marketId));
        assembly {
            store.slot := s
        }
    }

    function getCurrentPrice(
        Data storage self,
        Fee.TradeType tradeType
    ) internal view returns (uint256 price) {
        SpotMarketFactory.Data storage factory = SpotMarketFactory.load();
        if (tradeType == Fee.TradeType.BUY) {
            price = IOracleManagerModule(factory.oracle).process(self.buyFeedId).price.toUint();
        } else {
            price = IOracleManagerModule(factory.oracle).process(self.sellFeedId).price.toUint();
        }
    }

    function update(Data storage self, bytes32 buyFeedId, bytes32 sellFeedId) internal {
        self.buyFeedId = buyFeedId;
        self.sellFeedId = sellFeedId;
    }

    function usdSynthExchangeRate(
        Data storage self,
        uint128 marketId,
        uint amountUsd,
        Fee.TradeType tradeType
    ) internal returns (uint256 synthAmount) {
        uint256 currentPrice = getCurrentPrice(self, tradeType);
        amountUsd = uint(
            amountUsd.toInt() + calculateSkewAdjustment(self, marketId, amountUsd, tradeType)
        );
        synthAmount = amountUsd.divDecimal(currentPrice);
    }

    function synthUsdExchangeRate(
        Data storage self,
        uint128 marketId,
        uint sellAmount,
        Fee.TradeType tradeType
    ) internal returns (uint256 amountUsd) {
        uint256 currentPrice = getCurrentPrice(self, tradeType);
        amountUsd = sellAmount.mulDecimal(currentPrice);
        amountUsd = uint(
            amountUsd.toInt() + calculateSkewAdjustment(self, marketId, amountUsd, tradeType)
        );
    }

    // TODO: Applied in all cases except reportedDebt, wrapping
    function calculateSkewAdjustment(
        Data storage self,
        uint128 marketId,
        uint amount,
        Fee.TradeType tradeType
    ) internal returns (int skewAdjustment) {
        if (self.skewScale == 0) {
            return 0;
        }

        bool isBuyTrade = tradeType == Fee.TradeType.BUY || tradeType == Fee.TradeType.ASYNC_BUY;
        bool isSellTrade = tradeType == Fee.TradeType.SELL || tradeType == Fee.TradeType.ASYNC_SELL;

        if (!isBuyTrade && !isSellTrade) {
            return 0;
        }

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply().mulDecimal(
            getCurrentPrice(self, tradeType)
        );

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        uint wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateralAmount(marketId, wrapper.collateralType);

        uint initialSkew = totalBalance - wrappedMarketCollateral;
        uint initialSkewAdjustment = initialSkew.divDecimal(self.skewScale);

        uint skewAfterFill = initialSkew;
        // TODO: when the Adjustment after fill is calculated, does it take into account the Adjustments collected for the trade?
        if (isBuyTrade) {
            skewAfterFill += amount;
        } else if (isSellTrade) {
            skewAfterFill -= amount;
        }
        uint skewAfterFillAdjustment = skewAfterFill.divDecimal(self.skewScale);

        int skewAdjustmentAverage = (skewAfterFillAdjustment.toInt() +
            initialSkewAdjustment.toInt()).divDecimal(2);

        skewAdjustment = isSellTrade ? skewAdjustmentAverage * -1 : skewAdjustmentAverage;
    }
}
