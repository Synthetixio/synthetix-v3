import { ethers } from 'ethers';
import { Systems } from '../bootstrap';
import { SynthMarkets } from '@synthetixio/spot-market/test/common';
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
  skewScale: Wei;
  discountScalar: Wei;
  lowerLimitDiscount: Wei;
  upperLimitDiscount: Wei;
};

export const discountedValue = (
  amount: Wei,
  price: Wei,
  { skewScale, discountScalar, lowerLimitDiscount, upperLimitDiscount }: CollateralConfig
) => {
  const impactOnSkew = amount.div(skewScale).mul(discountScalar);
  const discount = Wei.max(Wei.min(impactOnSkew, lowerLimitDiscount), upperLimitDiscount);

  return amount.mul(price).mul(wei(1).sub(discount));
};
