import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import {
  SpotMarketSpotMarketProxy,
  SynthetixCollateralMock,
  SynthetixCoreProxy,
  SynthetixOracle_managerProxy,
  SynthetixUSDProxy,
  PerpsMarketProxy,
  AccountProxy,
} from '../../generated/typechain';
import { SynthRouter } from '@synthetixio/spot-market/typechain-types';

type Proxies = {
  ['synthetix.CoreProxy']: SynthetixCoreProxy;
  ['synthetix.USDProxy']: SynthetixUSDProxy;
  ['synthetix.CollateralMock']: SynthetixCollateralMock;
  ['synthetix.oracle_manager.Proxy']: SynthetixOracle_managerProxy;
  ['spotMarket.SpotMarketProxy']: SpotMarketSpotMarketProxy;
  PerpsMarketProxy: PerpsMarketProxy;
  AccountProxy: AccountProxy;
  ['spotMarket.SynthRouter']: SynthRouter;
};

export type Systems = {
  SpotMarket: SpotMarketSpotMarketProxy;
  Core: SynthetixCoreProxy;
  USD: SynthetixUSDProxy;
  CollateralMock: SynthetixCollateralMock;
  OracleManager: SynthetixOracle_managerProxy;
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

export const bn = (n: number) => wei(n).toBN();
