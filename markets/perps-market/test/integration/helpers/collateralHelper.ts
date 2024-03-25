import { ethers } from 'ethers';
import { Systems, bn } from '../bootstrap';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
import { SpotMarketProxy } from '@synthetixio/spot-market/test/generated/typechain';
import Wei, { wei } from '@synthetixio/wei';

type CollateralSynthData = {
  synthMarket?: () => SynthMarkets[number];
  snxUSDAmount: () => ethers.BigNumber;
};

export type DepositCollateralData = {
  systems: () => Systems;
  trader: () => ethers.Signer;
  accountId: () => number;
  collaterals: CollateralSynthData[];
};

type SynthStats = {
  spotInitialBalance: () => ethers.BigNumber;
  perpsInitialBalance: () => ethers.BigNumber;
  tradeFee: () => ethers.BigNumber;
  spotFinalBalance: () => ethers.BigNumber;
  perpsFinalBalance: () => ethers.BigNumber;
};

type DepositCollateralReturn = {
  stats: () => SynthStats[];
};

export const depositCollateral: (
  data: DepositCollateralData
) => Promise<DepositCollateralReturn> = async (data) => {
  const stats: SynthStats[] = [];
  const { systems, trader, accountId } = data;

  for (let i = 0; i < data.collaterals.length; i++) {
    let spotInitialBalance: ethers.BigNumber;
    let perpsInitialBalance: ethers.BigNumber;
    let spotFinalBalance: ethers.BigNumber;
    let perpsFinalBalance: ethers.BigNumber;
    let totalFees: ethers.BigNumber;

    const collateral = data.collaterals[i];

    if (collateral.synthMarket === undefined || collateral.synthMarket().marketId().isZero()) {
      // if undefined or marketId == 0 it means is snxUSD.
      totalFees = ethers.constants.Zero;

      // Record initial balances
      spotInitialBalance = await systems().USD.balanceOf(await trader().getAddress());
      perpsInitialBalance = await systems().USD.balanceOf(systems().PerpsMarket.address);

      // Add Collateral
      await systems()
        .PerpsMarket.connect(trader())
        .modifyCollateral(accountId(), 0, collateral.snxUSDAmount());

      // Record final balances
      spotFinalBalance = await systems().USD.balanceOf(await trader().getAddress());
      perpsFinalBalance = await systems().USD.balanceOf(systems().PerpsMarket.address);
    } else {
      const marketId = collateral.synthMarket().marketId();

      // collateral find out how much synth we'll get
      const { synthAmount, fees } = await systems()
        .SpotMarket.connect(trader())
        .quoteBuyExactIn(marketId, collateral.snxUSDAmount(), 0);

      totalFees = fees.fixedFees.add(fees.utilizationFees).add(fees.skewFees).add(fees.wrapperFees);

      // trade snxUSD for synth
      await systems()
        .SpotMarket.connect(trader())
        .buy(marketId, collateral.snxUSDAmount(), 0, ethers.constants.AddressZero);

      // approve amount of collateral to be transfered to the market
      await collateral
        .synthMarket()
        .synth()
        .connect(trader())
        .approve(systems().PerpsMarket.address, synthAmount);

      // Record initial balances
      spotInitialBalance = await collateral
        .synthMarket()
        .synth()
        .balanceOf(await trader().getAddress());
      perpsInitialBalance = await collateral
        .synthMarket()
        .synth()
        .balanceOf(systems().PerpsMarket.address);

      // Add Collateral
      await systems()
        .PerpsMarket.connect(trader())
        .modifyCollateral(data.accountId(), marketId, synthAmount);

      // Record final balances
      spotFinalBalance = await collateral
        .synthMarket()
        .synth()
        .balanceOf(await trader().getAddress());
      perpsFinalBalance = await collateral
        .synthMarket()
        .synth()
        .balanceOf(systems().PerpsMarket.address);
    }

    stats.push({
      spotInitialBalance: () => spotInitialBalance,
      perpsInitialBalance: () => perpsInitialBalance,
      tradeFee: () => totalFees,
      spotFinalBalance: () => spotFinalBalance,
      perpsFinalBalance: () => perpsFinalBalance,
    });
  }

  return {
    stats: () => stats,
  };
};

type CollateralConfig = {
  skewScale: ethers.BigNumber;
  discountScalar: ethers.BigNumber;
  lowerLimitDiscount: ethers.BigNumber;
  upperLimitDiscount: ethers.BigNumber;
};

type ValueInputs = {
  amount: Wei;
  synthId: ethers.BigNumber;
  config: CollateralConfig;
}[];

export const discountedValue = async (inputs: ValueInputs, spotMarket: SpotMarketProxy) => {
  return await inputs.reduce(
    async (total, input) => {
      const { amount, synthId, config } = input;
      const { skewScale, discountScalar, lowerLimitDiscount, upperLimitDiscount } = config;
      const impactOnSkew = amount.div(wei(skewScale)).mul(wei(discountScalar));
      const discount = Wei.max(
        Wei.min(impactOnSkew, wei(lowerLimitDiscount)),
        wei(upperLimitDiscount)
      );

      const collValue = await collateralValue(amount, synthId, spotMarket);
      const quote = collValue.mul(wei(1).sub(discount));

      return (await total).add(quote);
    },
    Promise.resolve(wei(0))
  );
};

export const collateralValue = async (
  amount: Wei,
  synthId: ethers.BigNumber,
  spotMarket: SpotMarketProxy
) => {
  const { returnAmount } = await spotMarket.quoteSellExactIn(synthId, amount.toBN(), bn(0));
  return wei(returnAmount);
};
