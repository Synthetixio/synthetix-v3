import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { PerpsMarketProxy, AccountProxy } from '../../generated/typechain';
import { SpotMarketProxy, SynthRouter } from '@synthetixio/spot-market/test/generated/typechain';
import { SynthArguments, bootstrapSynthMarkets } from '@synthetixio/spot-market/test/common';
import { PerpsMarketData, bootstrapPerpsMarkets, bootstrapTraders } from '.';
import { MockPyth } from '@synthetixio/oracle-manager/typechain-types';
import { CoreProxy, USDProxy } from '@synthetixio/main/test/generated/typechain';
import { Proxy as OracleManagerProxy } from '@synthetixio/oracle-manager/test/generated/typechain';
import { CollateralMock } from '@synthetixio/main/typechain-types';

type Proxies = {
  ['synthetix.CoreProxy']: CoreProxy;
  ['synthetix.USDProxy']: USDProxy;
  ['synthetix.CollateralMock']: CollateralMock;
  ['synthetix.oracle_manager.Proxy']: OracleManagerProxy;
  ['spotMarket.SpotMarketProxy']: SpotMarketProxy;
  PerpsMarketProxy: PerpsMarketProxy;
  AccountProxy: AccountProxy;
  ['spotMarket.SynthRouter']: SynthRouter;
  ['MockPyth']: MockPyth;
};

export type Systems = {
  SpotMarket: SpotMarketProxy;
  Core: CoreProxy;
  USD: USDProxy;
  CollateralMock: CollateralMock;
  MockPyth: MockPyth;
  OracleManager: OracleManagerProxy;
  PerpsMarket: PerpsMarketProxy;
  Account: AccountProxy;
  Synth: (address: string) => SynthRouter;
};

const params = { cannonfile: 'cannonfile.test.toml' };

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>(params);

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  before(restoreSnapshot);

  let contracts: Systems;
  before('load contracts', () => {
    contracts = {
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      SpotMarket: getContract('spotMarket.SpotMarketProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      CollateralMock: getContract('synthetix.CollateralMock'),
      PerpsMarket: getContract('PerpsMarketProxy'),
      Account: getContract('AccountProxy'),
      MockPyth: getContract('MockPyth'),
      Synth: (address: string) => getContract('spotMarket.SynthRouter', address),
    };
  });

  before('set snxUSD limit to max', async () => {
    // set max collateral amt for snxUSD to maxUINT
    await contracts.PerpsMarket.connect(getSigners()[0]).setMaxCollateralAmount(
      0, // snxUSD
      ethers.constants.MaxUint256
    );
  });

  return {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => contracts,
  };
}

type BootstrapArgs = {
  synthMarkets: SynthArguments;
  perpsMarkets: PerpsMarketData;
  traderAccountIds: Array<number>;
  liquidationGuards?: {
    minLiquidationReward: ethers.BigNumber;
    maxLiquidationReward: ethers.BigNumber;
  };
};

export function bootstrapMarkets(data: BootstrapArgs) {
  const chainStateWithPerpsMarkets = bootstrapPerpsMarkets(data.perpsMarkets, undefined);

  const { synthMarkets } = bootstrapSynthMarkets(data.synthMarkets, chainStateWithPerpsMarkets);

  const { systems, signers, provider, owner, perpsMarkets, marketOwner, poolId } =
    chainStateWithPerpsMarkets;
  const { trader1, trader2, keeper, restore } = bootstrapTraders({
    systems,
    signers,
    provider,
    owner,
    accountIds: data.traderAccountIds,
  });

  // auto set all synth markets collaterals to max
  before('set collateral max', async () => {
    for (const { marketId } of synthMarkets()) {
      await systems()
        .PerpsMarket.connect(owner())
        .setMaxCollateralForSynthMarketId(marketId(), ethers.constants.MaxUint256);
    }
  });

  // auto add all synth markets in the row they were created for deduction priority
  before('set synth deduction priority', async () => {
    // first item is always snxUSD
    const synthIds = [bn(0), ...synthMarkets().map((s) => s.marketId())];
    await systems().PerpsMarket.connect(owner()).setSynthDeductionPriority(synthIds);
  });
  const { liquidationGuards } = data;
  if (liquidationGuards) {
    before('set liquidation guards', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setLiquidationRewardGuards(
          liquidationGuards.minLiquidationReward,
          liquidationGuards.maxLiquidationReward
        );
    });
  }

  return {
    systems,
    signers,
    provider,
    restore,
    trader1,
    trader2,
    keeper,
    owner,
    perpsMarkets,
    synthMarkets,
    marketOwner,
    poolId,
  };
}

export const bn = (n: number) => wei(n).toBN();
export const toNum = (n: ethers.BigNumber) => Number(ethers.utils.formatEther(n));
