import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { bootstrapStakers, bootstrapWithStakedPool } from '@synthetixio/main/test/integration';
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
} from '../generated/typechain';

type Proxies = {
  ['synthetix.CoreProxy']: SynthetixCoreProxy;
  ['synthetix.USDProxy']: SynthetixUSDProxy;
  ['synthetix.CollateralMock']: SynthetixCollateralMock;
  ['synthetix.oracle_manager.Proxy']: SynthetixOracle_managerProxy;
  ['spotMarket.SpotMarketProxy']: SpotMarketSpotMarketProxy;
  PerpsMarketProxy: PerpsMarketProxy;
  AccountProxy: AccountProxy;
};

export type Systems = {
  SpotMarket: SpotMarketSpotMarketProxy;
  Core: SynthetixCoreProxy;
  USD: SynthetixUSDProxy;
  CollateralMock: SynthetixCollateralMock;
  OracleManager: SynthetixOracle_managerProxy;
  PerpsMarket: PerpsMarketProxy;
  Account: AccountProxy;
};

const params = { cannonfile: 'cannonfile.test.toml' };

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>(params);

const restoreSnapshot = createSnapshot();

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
  };
});

export function bootstrap() {
  before(restoreSnapshot);

  return {
    provider: () => getProvider(),
    signers: () => getSigners(),
    owner: () => getSigners()[0],
    systems: () => contracts,
  };
}

export function bootstrapPerpsMarket(name: string, token: string) {
  const r = bootstrapWithStakedPool(bootstrap(), bn(1000));
  let coreOwner: ethers.Signer, marketOwner: ethers.Signer, marketId: string;
  let contracts: Systems;

  before('identify contracts', () => {
    contracts = r.systems() as Systems;
  });

  before('identify market owner', async () => {
    [coreOwner, , marketOwner] = r.signers();
  });

  before('register perps market', async () => {
    marketId = await contracts.PerpsMarket.callStatic.createMarket(
      name,
      token,
      marketOwner.getAddress()
    );
    await contracts.PerpsMarket.createMarket(name, token, marketOwner.getAddress());
  });

  before('setup feed', async () => {
    await contracts.PerpsMarket.connect(marketOwner).updatePriceData(marketId, r.oracleNodeId());
  });

  before('set max collateral amount for snxUSD', async () => {
    await contracts.PerpsMarket.connect(coreOwner).setMaxCollateralAmount(
      0,
      ethers.constants.MaxUint256
    );
  });

  before('delegate pool collateral to market', async () => {
    await contracts.Core.connect(coreOwner).setPoolConfiguration(r.poolId, [
      {
        marketId,
        weightD18: ethers.utils.parseEther('1'),
        maxDebtShareValueD18: ethers.utils.parseEther('1'),
      },
    ]);
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    systems: (): Systems => contracts,
    marketId: () => marketId,
    marketOwner: () => marketOwner,
    restore,
  };
}

/*
  1. creates a new pool
  2. mints collateral for new users
  3. delegates collateral to pool
  4. mint max USD
  5. traders now have USD to trade with
*/
export function bootstrapTraders(r: ReturnType<typeof bootstrapPerpsMarket>) {
  bootstrapStakers(r.systems, r.signers);

  before('provide access to create account', async () => {
    const [owner, , , trader1, trader2] = r.signers();
    await r
      .systems()
      .PerpsMarket.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        trader1.getAddress()
      );
    await r
      .systems()
      .PerpsMarket.connect(owner)
      .addToFeatureFlagAllowlist(
        ethers.utils.formatBytes32String('createAccount'),
        trader2.getAddress()
      );
  });

  before('infinite approve to perps market proxy', async () => {
    const [, , , trader1, trader2] = r.signers();
    await r
      .systems()
      .USD.connect(trader1)
      .approve(r.systems().PerpsMarket.address, ethers.constants.MaxUint256);
    await r
      .systems()
      .USD.connect(trader2)
      .approve(r.systems().PerpsMarket.address, ethers.constants.MaxUint256);
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    restore,
  };
}

export const bn = (n: number) => wei(n).toBN();
