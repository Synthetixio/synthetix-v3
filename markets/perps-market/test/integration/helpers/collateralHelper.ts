import { ethers } from 'ethers';
import { Systems } from '../bootstrap';

type IncomingChainState = {
  systems: () => Systems;
  provider: () => ethers.providers.JsonRpcProvider;
};

type TradeSynthData = {
  synthName: () => string;
  synthMarketId: () => ethers.BigNumberish;
  synthMarket: () => ethers.Contract;
  marginAmount: () => ethers.BigNumberish;
  synthAmount: () => ethers.BigNumberish;
};

export type SetCollateralData = {
  trader: () => ethers.Signer;
  accountId: () => number;
  trades: TradeSynthData[];
};

type SynthStats = {
  spotInitialBalance: () => ethers.BigNumber;
  perpsInitialBalance: () => ethers.BigNumber;
  spotFinalBalance: () => ethers.BigNumber;
  perpsFinalBalance: () => ethers.BigNumber;
};

type SetCollateralReturn = {
  stats: () => SynthStats[];
};

type SetCollateralType = (
  data: SetCollateralData,
  chainState: IncomingChainState
) => Promise<SetCollateralReturn>;

export const depositCollateral: SetCollateralType = async (data, chainState) => {
  let stats: SynthStats[] = [];

  for (let i = 0; i < data.trades.length; i++) {
    let spotInitialBalance: ethers.BigNumber;
    let perpsInitialBalance: ethers.BigNumber;
    let spotFinalBalance: ethers.BigNumber;
    let perpsFinalBalance: ethers.BigNumber;

    const trade = data.trades[i];
    const isSnxUSD = ethers.BigNumber.from(trade.synthMarketId()).isZero();

    if (isSnxUSD) {
      // No need to trade since marketId is 0 (snxUSD)

      // Record initial balances
      spotInitialBalance = await chainState
        .systems()
        .USD.balanceOf(await data.trader().getAddress());
      perpsInitialBalance = await chainState
        .systems()
        .USD.balanceOf(chainState.systems().PerpsMarket.address);

      // Add Collateral
      await chainState
        .systems()
        .PerpsMarket.connect(data.trader())
        .modifyCollateral(data.accountId(), trade.synthMarketId(), trade.synthAmount());

      // Record final balances
      spotFinalBalance = await chainState.systems().USD.balanceOf(await data.trader().getAddress());
      perpsFinalBalance = await chainState
        .systems()
        .USD.balanceOf(chainState.systems().PerpsMarket.address);
    } else {
      // Trade snxUSD for synth
      await chainState
        .systems()
        .SpotMarket.connect(data.trader())
        .buy(
          trade.synthMarketId(),
          trade.marginAmount(),
          trade.synthAmount(),
          ethers.constants.AddressZero
        );

      // Trader approves perps market
      await trade
        .synthMarket()
        .connect(data.trader())
        .approve(chainState.systems().PerpsMarket.address, trade.synthAmount());

      // Record initial balances
      spotInitialBalance = await trade.synthMarket().balanceOf(await data.trader().getAddress());
      perpsInitialBalance = await trade
        .synthMarket()
        .balanceOf(chainState.systems().PerpsMarket.address);

      // Add Collateral
      await chainState
        .systems()
        .PerpsMarket.connect(data.trader())
        .modifyCollateral(data.accountId(), trade.synthMarketId(), trade.synthAmount());

      // Record final balances
      spotFinalBalance = await trade.synthMarket().balanceOf(await data.trader().getAddress());
      perpsFinalBalance = await trade
        .synthMarket()
        .balanceOf(chainState.systems().PerpsMarket.address);
    }

    stats.push({
      spotInitialBalance: () => spotInitialBalance,
      perpsInitialBalance: () => perpsInitialBalance,
      spotFinalBalance: () => spotFinalBalance,
      perpsFinalBalance: () => perpsFinalBalance,
    });
  }

  return {
    stats: () => stats,
  };
};
