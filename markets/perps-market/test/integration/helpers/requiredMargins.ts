import Wei from '@synthetixio/wei';

type Config = {
  initialMarginRatio: Wei;
  minimumInitialMarginRatio: Wei;
  maintenanceMarginScalar: Wei;
  liquidationRewardRatio: Wei;
};

export const requiredMargins = (config: Config, size: Wei, price: Wei, skewScale: Wei) => {
  const impactOnSkew = size.div(skewScale);
  const initialMarginRatio = impactOnSkew
    .mul(config.initialMarginRatio)
    .add(config.minimumInitialMarginRatio);

  const maintenanceMarginRatio = initialMarginRatio.mul(config.maintenanceMarginScalar);
  const notional = size.mul(price);

  return {
    initialMargin: notional.mul(initialMarginRatio),
    maintenanceMargin: notional.mul(maintenanceMarginRatio),
    liquidationMargin: notional.mul(config.liquidationRewardRatio),
  };
};
