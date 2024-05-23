import { BigNumber } from 'ethers';
import Wei, { wei } from '@synthetixio/wei';
import type { Bs } from './typed';
import { PerpMarketConfiguration } from './generated/typechain/MarketConfigurationModule';
import { IPerpAccountModule } from '../typechain-types';

// --- Primitives --- //

const divDecimalAndCeil = (a: Wei, b: Wei) => {
  const x = wei(a).toNumber() / wei(b).toNumber();
  return wei(Math.ceil(x));
};

// --- Domain --- //

/** Calculates whether two numbers are the same sign. */
export const isSameSide = (a: Wei | BigNumber, b: Wei | BigNumber) =>
  a.eq(0) || b.eq(0) || a.gt(0) == b.gt(0);

// --- Calcs --- //

export const calcTotalPnls = (positionDigests: IPerpAccountModule.PositionDigestStructOutput[]) => {
  return positionDigests
    .map(({ pnl, accruedFunding, accruedUtilization }) =>
      wei(pnl).add(accruedFunding).sub(accruedUtilization)
    )
    .reduce((a, b) => a.add(b), wei(0));
};

/** Calculates a position's unrealised PnL (no funding or fees) given the current and previous price. */
export const calcPricePnl = (size: BigNumber, currentPrice: BigNumber, previousPrice: BigNumber) =>
  wei(size).mul(wei(currentPrice).sub(previousPrice)).toBN();

/** Calculates the fillPrice (pd adjusted market price) given market params and the size of next order. */
export const calcFillPrice = (
  skew: BigNumber,
  skewScale: BigNumber,
  size: BigNumber,
  price: BigNumber
) => {
  const calcPD = (skew: Wei, skewScale: Wei) => skew.div(skewScale);
  const calcAdjustedPrice = (price: Wei, pd: Wei) => price.add(price.mul(pd));

  if (skewScale.eq(0)) {
    return price;
  }
  const pdBefore = calcPD(wei(skew), wei(skewScale));
  const pdAfter = calcPD(wei(skew).add(size), wei(skewScale));

  const priceBefore = calcAdjustedPrice(wei(price), pdBefore);
  const priceAfter = calcAdjustedPrice(wei(price), pdAfter);

  return priceBefore.add(priceAfter).div(2).toBN();
};

/** Calculates order fees and keeper fees associated to settle the order. */
export const calcOrderFees = async (
  bs: Bs,
  marketId: BigNumber,
  sizeDelta: BigNumber,
  keeperFeeBufferUsd: BigNumber
) => {
  if (sizeDelta.eq(0)) {
    throw new Error('A sizeDelta of 0 will result in a NilOrder revert');
  }

  const { systems, ethOracleNode } = bs;
  const { BfpMarketProxy } = systems();

  const fillPrice = await BfpMarketProxy.getFillPrice(marketId, sizeDelta);
  const { skew } = await BfpMarketProxy.getMarketDigest(marketId);
  const { makerFee, takerFee } = await BfpMarketProxy.getMarketConfigurationById(marketId);

  let [makerSizeRatio, takerSizeRatio] = [wei(0), wei(0)];
  const marketSkewBefore = wei(skew);
  const marketSkewAfter = marketSkewBefore.add(sizeDelta);

  if (isSameSide(marketSkewAfter, marketSkewBefore)) {
    // Either a full maker or taker fee is charged on the entire size.
    if (isSameSide(sizeDelta, skew)) {
      [takerSizeRatio, makerSizeRatio] = [wei(1), wei(0)];
    } else {
      [takerSizeRatio, makerSizeRatio] = [wei(0), wei(1)];
    }
  } else {
    // Mixed. Reduced skew to 0 and then a bit more causing it to expand in the other dierction. Infer
    // the portion of size that is maker vs taker and calculate fees appropriately.
    takerSizeRatio = marketSkewBefore.add(sizeDelta).div(sizeDelta);
    makerSizeRatio = wei(1).sub(takerSizeRatio);
  }

  const notional = wei(sizeDelta).abs().mul(fillPrice);
  const orderFee = notional
    .mul(takerSizeRatio)
    .mul(takerFee)
    .add(notional.mul(makerSizeRatio).mul(makerFee))
    .toBN();

  // Get the current ETH price.
  const { answer: ethPrice } = await ethOracleNode().agg.latestRoundData();
  // Grab market configuration to infer price.
  const { keeperSettlementGasUnits, keeperProfitMarginPercent, minKeeperFeeUsd, maxKeeperFeeUsd } =
    await BfpMarketProxy.getMarketConfiguration();

  const calcKeeperOrderSettlementFee = (blockBaseFeePerGas: BigNumber) => {
    // Perform calc bounding by min/max to prevent going over/under.

    const baseKeeperFeeUsd = calcTransactionCostInUsd(
      blockBaseFeePerGas,
      keeperSettlementGasUnits,
      ethPrice
    );

    // Base keeperFee + profit margin and a small user specified buffer.
    const baseKeeperFeePlusProfit = wei(baseKeeperFeeUsd)
      .mul(wei(1).add(keeperProfitMarginPercent))
      .add(keeperFeeBufferUsd);

    // Ensure keeper fee doesn't exceed min/max bounds.
    const boundedKeeperFeeUsd = Wei.min(
      Wei.max(wei(minKeeperFeeUsd), baseKeeperFeePlusProfit),
      wei(maxKeeperFeeUsd)
    ).toBN();

    return boundedKeeperFeeUsd;
  };

  return { notional, orderFee, calcKeeperOrderSettlementFee };
};

export const calcKeeperCancellationFee = async (bs: Bs, blockBaseFeePerGas: BigNumber) => {
  const { systems, ethOracleNode } = bs;
  const { BfpMarketProxy } = systems();
  // Grab market configuration to infer price.
  const {
    keeperCancellationGasUnits,
    keeperProfitMarginPercent,
    minKeeperFeeUsd,
    maxKeeperFeeUsd,
  } = await BfpMarketProxy.getMarketConfiguration();
  const { answer: ethPrice } = await ethOracleNode().agg.latestRoundData();

  // Perform calc bounding by min/max to prevent going over/under.

  const baseKeeperFeeUsd = calcTransactionCostInUsd(
    blockBaseFeePerGas,
    keeperCancellationGasUnits,
    ethPrice
  );

  // Base keeperFee + profit margin.
  const baseKeeperFeePlusProfit = wei(baseKeeperFeeUsd).mul(wei(1).add(keeperProfitMarginPercent));

  // Ensure keeper fee doesn't exceed min/max bounds.
  const boundedKeeperFeeUsd = Wei.min(
    Wei.max(wei(minKeeperFeeUsd), baseKeeperFeePlusProfit),
    wei(maxKeeperFeeUsd)
  ).toBN();

  return boundedKeeperFeeUsd;
};

export const calcTransactionCostInUsd = (
  baseFeePerGas: BigNumber, // in gwei
  gasUnitsForTx: BigNumber, // in gwei
  ethPrice: BigNumber // in ether
) => {
  const costInGwei = baseFeePerGas.mul(gasUnitsForTx);
  return costInGwei.mul(ethPrice).div(BigNumber.from(10).pow(18));
};

/** Calculates the in USD, the reward to flag a position for liquidation. */
export const calcFlagReward = (
  ethPrice: BigNumber,
  baseFeePerGas: BigNumber, // in gwei
  sizeAbs: Wei,
  price: Wei,
  collateralUsd: Wei,
  globalConfig: PerpMarketConfiguration.GlobalDataStructOutput,
  marketConfig: PerpMarketConfiguration.DataStructOutput
) => {
  const flagExecutionCostInUsd = calcTransactionCostInUsd(
    baseFeePerGas,
    globalConfig.keeperFlagGasUnits,
    ethPrice
  );

  const flagFeeInUsd = Wei.max(
    wei(flagExecutionCostInUsd).mul(wei(1).add(globalConfig.keeperProfitMarginPercent)),
    wei(flagExecutionCostInUsd).add(wei(globalConfig.keeperProfitMarginUsd))
  );

  const notional = sizeAbs.mul(price);
  const flagFeeWithRewardInUsd = flagFeeInUsd.add(
    Wei.max(notional, collateralUsd).mul(marketConfig.liquidationRewardPercent)
  );

  return Wei.min(flagFeeWithRewardInUsd, wei(globalConfig.maxKeeperFeeUsd));
};

/** Calculates the liquidation fees in USD given price of ETH, gas, size of position and capacity. */
export const calcLiquidationKeeperFee = (
  ethPrice: BigNumber,
  baseFeePerGas: BigNumber, // in gwei
  sizeAbs: Wei,
  maxLiqCapacity: Wei,
  globalConfig: PerpMarketConfiguration.GlobalDataStructOutput
) => {
  if (sizeAbs.eq(0)) return wei(0);
  const iterations = divDecimalAndCeil(sizeAbs, maxLiqCapacity);

  const totalGasUnitsToLiquidate = wei(globalConfig.keeperLiquidationGasUnits).toBN();
  const flagExecutionCostInUsd = calcTransactionCostInUsd(
    baseFeePerGas,
    totalGasUnitsToLiquidate,
    ethPrice
  );

  const liquidationFeeInUsd = Wei.max(
    wei(flagExecutionCostInUsd).mul(wei(1).add(globalConfig.keeperProfitMarginPercent)),
    wei(flagExecutionCostInUsd).add(wei(globalConfig.keeperProfitMarginUsd))
  );

  return Wei.min(liquidationFeeInUsd.mul(iterations), wei(globalConfig.maxKeeperFeeUsd));
};

/** Calculates the discounted collateral price given the size, spot market skew scale, and min/max discounts. */
export const calcDiscountedCollateralPrice = (
  collateralPrice: BigNumber,
  amount: BigNumber,
  skewScale: BigNumber,
  collateralDiscountScalar: BigNumber,
  min: BigNumber,
  max: BigNumber
) => {
  const w_collateralPrice = wei(collateralPrice);
  const w_amount = wei(amount);
  const w_skewScale = wei(skewScale);
  const w_collateralDiscountScalar = wei(collateralDiscountScalar);
  const w_min = wei(min);
  const w_max = wei(max);

  // price = oraclePrice * (1 - min(max(size / (skewScale * skewScaleScalar), minCollateralDiscount), maxCollateralDiscount))
  const discount = Wei.min(
    Wei.max(w_amount.mul(w_collateralDiscountScalar).div(w_skewScale), w_min),
    w_max
  );
  return w_collateralPrice.mul(wei(1).sub(discount)).toBN();
};

export const calcUtilization = async (bs: Bs, marketId: BigNumber) => {
  const { BfpMarketProxy, Core } = bs.systems();

  // Get delegated usd amount
  const withdrawable = await Core.getWithdrawableMarketUsd(marketId);
  const { totalCollateralValueUsd } = await BfpMarketProxy.getMarketDigest(marketId);
  const delegatedAmountUsd = wei(withdrawable).sub(totalCollateralValueUsd);
  const { size, oraclePrice } = await BfpMarketProxy.getMarketDigest(marketId);
  const lockedCollateralUsd = wei(size).mul(oraclePrice);

  return Wei.min(lockedCollateralUsd.div(delegatedAmountUsd), wei(1));
};

export const calcUtilizationRate = async (bs: Bs, utilization: Wei) => {
  const { BfpMarketProxy } = bs.systems();
  const globalMarketConfig = await BfpMarketProxy.getMarketConfiguration();
  const utilizationBreakpointPercent = wei(globalMarketConfig.utilizationBreakpointPercent);
  const lowUtilizationSlopePercent = wei(globalMarketConfig.lowUtilizationSlopePercent);
  const highUtilizationSlopePercent = wei(globalMarketConfig.highUtilizationSlopePercent);

  if (utilization.lt(utilizationBreakpointPercent)) {
    return wei(lowUtilizationSlopePercent).mul(utilization).mul(100);
  } else {
    const lowPart = lowUtilizationSlopePercent.mul(utilizationBreakpointPercent).mul(100);
    const highPart = highUtilizationSlopePercent
      .mul(wei(utilization).sub(utilizationBreakpointPercent))
      .mul(100);
    return lowPart.add(highPart);
  }
};

export const calcDebtCorrection = (
  prevDebtCorrection: Wei,
  fundingDelta: Wei,
  notionalDelta: Wei,
  totalPositionPnl: Wei
) => {
  return prevDebtCorrection.add(fundingDelta).add(notionalDelta).add(totalPositionPnl);
};
