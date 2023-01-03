//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/main/contracts/interfaces/IMarketCollateralModule.sol";
import "@synthetixio/main/contracts/interfaces/IMarketManagerModule.sol";
import "@synthetixio/core-contracts/contracts/utils/SafeCast.sol";
import "../utils/SynthUtil.sol";
import "../storage/SpotMarketFactory.sol";
import "../interfaces/external/IFeeCollector.sol";
import "./Price.sol";
import "./Wrapper.sol";

import "hardhat/console.sol";

library Fee {
    using DecimalMath for uint256;
    using DecimalMath for int256;
    using Price for Price.Data;
    using SpotMarketFactory for SpotMarketFactory.Data;
    using SafeCastU256 for uint256;
    using SafeCastI256 for int256;

    struct Data {
        // used for direct integrations
        mapping(address => uint) atomicFixedFeeOverrides;
        // defaults
        uint atomicFixedFee;
        uint asyncFixedFee;
        uint utilizationFeeRate; // in bips, applied on buy and async buy
        int wrapFixedFee;
        int unwrapFixedFee;
        uint skewScale;
        IFeeCollector feeCollector;
    }

    function load(uint128 marketId) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.spot-market.Fee", marketId));
        assembly {
            store.slot := s
        }
    }

    function setAtomicFixedFeeOverride(
        uint128 marketId,
        address transactor,
        uint fixedFee
    ) internal {
        load(marketId).atomicFixedFeeOverrides[transactor] = fixedFee;
    }

    function processFees(
        uint128 marketId,
        address transactor,
        uint256 usdAmount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (uint256 amountUsable, int256 totalFees, uint collectedFees) {
        (amountUsable, totalFees) = calculateFees(marketId, transactor, usdAmount, transactionType);

        // TODO: negative fees are ignored.  Verify this.
        if (totalFees > 0) {
            collectedFees = collectFees(marketId, totalFees.toUint());
        }
    }

    function calculateFees(
        uint128 marketId,
        address transactor,
        uint256 usdAmount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (uint256 amountUsable, int256 feesCollected) {
        Data storage self = load(marketId);

        if (
            transactionType == SpotMarketFactory.TransactionType.BUY ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY
        ) {
            (amountUsable, feesCollected) = calculateBuyFees(
                self,
                transactor,
                marketId,
                usdAmount,
                transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY
            );
        } else if (
            transactionType == SpotMarketFactory.TransactionType.SELL ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL
        ) {
            (amountUsable, feesCollected) = calculateSellFees(
                self,
                transactor,
                marketId,
                usdAmount,
                transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL
            );
        } else if (transactionType == SpotMarketFactory.TransactionType.WRAP) {
            (amountUsable, feesCollected) = calculateWrapFees(self, usdAmount);
        } else if (transactionType == SpotMarketFactory.TransactionType.UNWRAP) {
            (amountUsable, feesCollected) = calculateUnwrapFees(self, usdAmount);
        } else {
            amountUsable = usdAmount;
            feesCollected = 0;
        }
    }

    function calculateWrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, self.wrapFixedFee);
    }

    function calculateUnwrapFees(
        Data storage self,
        uint256 amount
    ) internal view returns (uint amountUsable, int feesCollected) {
        (amountUsable, feesCollected) = _applyFees(amount, self.unwrapFixedFee);
    }

    function calculateBuyFees(
        Data storage self,
        address transactor,
        uint128 marketId,
        uint256 amount,
        bool async
    ) internal returns (uint amountUsable, int feesCollected) {
        uint utilizationFee = calculateUtilizationRateFee(
            self,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.BUY
        );

        int skewFee = calculateSkewFee(
            self,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.BUY
        );

        uint fixedFee = async ? self.asyncFixedFee : _getAtomicFixedFee(self, transactor);

        int totalFees = utilizationFee.toInt() + skewFee + fixedFee.toInt();

        (amountUsable, feesCollected) = _applyFees(amount, totalFees);
    }

    function calculateSellFees(
        Data storage self,
        address transactor,
        uint128 marketId,
        uint256 amount,
        bool async
    ) internal returns (uint amountUsable, int feesCollected) {
        int skewFee = calculateSkewFee(
            self,
            marketId,
            amount,
            SpotMarketFactory.TransactionType.SELL
        );

        uint fixedFee = async ? self.asyncFixedFee : _getAtomicFixedFee(self, transactor);
        int totalFees = skewFee + fixedFee.toInt();

        (amountUsable, feesCollected) = _applyFees(amount, totalFees);
    }

    function calculateSkewFee(
        Data storage self,
        uint128 marketId,
        uint amount,
        SpotMarketFactory.TransactionType transactionType
    ) internal returns (int skewFee) {
        if (self.skewScale == 0) {
            return 0;
        }

        bool isBuyTrade = transactionType == SpotMarketFactory.TransactionType.BUY ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_BUY;
        bool isSellTrade = transactionType == SpotMarketFactory.TransactionType.SELL ||
            transactionType == SpotMarketFactory.TransactionType.ASYNC_SELL;

        if (!isBuyTrade && !isSellTrade) {
            return 0;
        }

        uint collateralPrice = Price.getCurrentPrice(marketId, transactionType);

        uint skewScaleValue = self.skewScale.mulDecimal(collateralPrice);

        uint totalSynthValue = SynthUtil.getToken(marketId).totalSupply().mulDecimal(
            collateralPrice
        );

        Wrapper.Data storage wrapper = Wrapper.load(marketId);
        uint wrappedMarketCollateral = 0;
        if (wrapper.wrappingEnabled) {
            wrappedMarketCollateral = IMarketCollateralModule(SpotMarketFactory.load().synthetix)
                .getMarketCollateralAmount(marketId, wrapper.collateralType)
                .mulDecimal(collateralPrice);
        }

        uint initialSkew = totalSynthValue - wrappedMarketCollateral;
        uint initialSkewAdjustment = initialSkew.divDecimal(skewScaleValue);

        uint skewAfterFill = initialSkew;
        // TODO: when the Adjustment after fill is calculated, does it take into account the Adjustments collected for the trade?
        if (isBuyTrade) {
            skewAfterFill += amount;
        } else if (isSellTrade) {
            skewAfterFill -= amount;
        }

        uint skewAfterFillAdjustment = skewAfterFill.divDecimal(skewScaleValue);
        int skewAdjustmentAveragePercentage = (skewAfterFillAdjustment.toInt() +
            initialSkewAdjustment.toInt()) / 2;

        // convert to basis points
        int skewFeeInBips = skewAdjustmentAveragePercentage.mulDecimal(10_000e18);
        skewFee = isSellTrade ? skewFeeInBips * -1 : skewFeeInBips;
    }

    function calculateUtilizationRateFee(
        Data storage self,
        uint128 marketId,
        uint amount,
        SpotMarketFactory.TransactionType transactionType
    ) internal view returns (uint utilFee) {
        if (self.utilizationFeeRate == 0) {
            return 0;
        }

        uint delegatedCollateral = IMarketManagerModule(SpotMarketFactory.load().synthetix)
            .getMarketCollateral(marketId);

        uint totalBalance = SynthUtil.getToken(marketId).totalSupply();
        uint totalValue = totalBalance.mulDecimal(
            Price.getCurrentPrice(marketId, transactionType)
        ) + amount;

        // utilization is below 100%
        if (delegatedCollateral > totalValue) {
            return 0;
        } else {
            uint utilization = totalValue.divDecimal(delegatedCollateral);

            utilFee = utilization.mulDecimal(self.utilizationFeeRate);
        }
    }

    // TODO: should this live here?  What's a better place? FeeConfigurationModule
    function collectFees(uint128 marketId, uint totalFees) internal returns (uint collectedFees) {
        IFeeCollector feeCollector = load(marketId).feeCollector;
        SpotMarketFactory.Data storage store = SpotMarketFactory.load();

        if (address(feeCollector) != address(0)) {
            store.usdToken.approve(address(feeCollector), totalFees);

            uint previousUsdBalance = store.usdToken.balanceOf(address(this));
            feeCollector.collectFees(marketId, totalFees);
            uint currentUsdBalance = store.usdToken.balanceOf(address(this));
            collectedFees = currentUsdBalance - previousUsdBalance;

            store.usdToken.approve(address(feeCollector), 0);
        }

        store.depositToMarketManager(marketId, msg.sender, totalFees - collectedFees);
    }

    function _applyFees(
        uint amount,
        int fees // bips 18 decimals
    ) private view returns (uint amountUsable, int feesCollected) {
        // bips are 18 decimals precision
        feesCollected = fees.mulDecimal(amount.toInt()).divDecimal(10000e18);
        amountUsable = (amount.toInt() - feesCollected).toUint();
    }

    function _getAtomicFixedFee(Data storage self, address transactor) private view returns (uint) {
        return
            self.atomicFixedFeeOverrides[transactor] > 0
                ? self.atomicFixedFeeOverrides[transactor]
                : self.atomicFixedFee;
    }
}
