import { wei, Wei } from '@synthetixio/wei';

type Config = {
  initialMarginRatio: Wei;
  minimumInitialMarginRatio: Wei;
  maintenanceMarginScalar: Wei;
  liquidationRewardRatio: Wei;
};

export const requiredMargins = (config: Config, size: Wei, fillPrice: Wei, skewScale: Wei) => {
  const impactOnSkew = size.div(skewScale);
  const initialMarginRatio = impactOnSkew
    .mul(config.initialMarginRatio)
    .add(config.minimumInitialMarginRatio);

  const maintenanceMarginRatio = initialMarginRatio.mul(config.maintenanceMarginScalar);
  const notional = size.mul(fillPrice);

  return {
    initialMargin: notional.mul(initialMarginRatio),
    maintenanceMargin: notional.mul(maintenanceMarginRatio),
    liquidationMargin: notional.mul(config.liquidationRewardRatio),
  };
};

export const getRequiredLiquidationRewardMargin = (
  reward: Wei,
  liqGuards: {
    minLiquidationReward: Wei;
    minKeeperProfitRatioD18: Wei;
    maxLiquidationReward: Wei;
    maxKeeperScalingRatioD18: Wei;
  },
  liqParams: {
    costOfTx: Wei;
    margin: Wei;
  }
) => {
  const minCap = Wei.max(
    liqGuards.minLiquidationReward,
    liqParams.costOfTx.mul(liqGuards.minKeeperProfitRatioD18)
  );
  const maxCap = Wei.min(
    liqGuards.maxLiquidationReward,
    liqParams.margin.mul(liqGuards.maxKeeperScalingRatioD18)
  );
  return Wei.min(Wei.max(reward, minCap), maxCap);
};

export const expectedStartingPnl = (marketPrice: Wei, fillPrice: Wei, positionSize: Wei) => {
  return Wei.min(positionSize.mul(marketPrice.sub(fillPrice)), wei(0));
};
