import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { coreBootstrap } from '@synthetixio/router/dist/utils/tests';
import { bootstrapStakers, createStakedPool } from '@synthetixio/main/test/common';
import { wei } from '@synthetixio/wei';
import { BigNumber, ethers } from 'ethers';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';
import { FeeCollectorMock, SpotMarketProxy, SynthRouter } from './generated/typechain';
import {
  USDProxy,
  CollateralMock,
  USDRouter,
  CoreProxy,
  AccountProxy,
} from '@synthetixio/main/test/generated/typechain';
import { Proxy as OracleManagerProxy } from '@synthetixio/oracle-manager/test/generated/typechain';
import { AggregatorV3Mock, OracleVerifierMock } from '../typechain-types';

type Proxies = {
  ['synthetix.CoreProxy']: CoreProxy;
  ['synthetix.USDProxy']: USDProxy;
  ['synthetix.CollateralMock']: CollateralMock;
  ['synthetix.oracle_manager.Proxy']: OracleManagerProxy;
  ['synthetix.AccountProxy']: AccountProxy;
  SpotMarketProxy: SpotMarketProxy;
  SynthRouter: SynthRouter;
  FeeCollectorMock: FeeCollectorMock;
  OracleVerifierMock: OracleVerifierMock;
  ['synthetix.USDRouter']: USDRouter;
};

export type Systems = {
  SpotMarket: SpotMarketProxy;
  Core: CoreProxy;
  USD: USDProxy;
  USDRouter: USDRouter;
  CollateralMock: CollateralMock;
  OracleManager: OracleManagerProxy;
  OracleVerifierMock: OracleVerifierMock;
  FeeCollectorMock: FeeCollectorMock;
  Account: AccountProxy;
  Synth: (address: string) => SynthRouter;
};

const params = { cannonfile: 'cannonfile.test.toml' };

// TODO: find an alternative way for custom config on fork tests. Probably having
//       another bootstrap.ts on the test-fork/ folder would be best.
// hre.network.name === 'cannon'
//   ? { cannonfile: 'cannonfile.test.toml' }
//   : {
//       dryRun: true,
//       impersonate: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
//       cannonfile: 'cannonfile.test.toml',
//     };
const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>(params);

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  before(restoreSnapshot);
  const signers: ethers.Wallet[] = [];

  let contracts: Systems;
  before('load contracts', () => {
    contracts = {
      Account: getContract('synthetix.AccountProxy'),
      Core: getContract('synthetix.CoreProxy'),
      USD: getContract('synthetix.USDProxy'),
      USDRouter: getContract('synthetix.USDRouter'),
      SpotMarket: getContract('SpotMarketProxy'),
      OracleManager: getContract('synthetix.oracle_manager.Proxy'),
      CollateralMock: getContract('synthetix.CollateralMock'),
      FeeCollectorMock: getContract('FeeCollectorMock'),
      OracleVerifierMock: getContract('OracleVerifierMock'),
      Synth: (address: string) => getContract('SynthRouter', address),
    };
  });

  before('set up accounts', async () => {
    const provider = getProvider();
    for (let i = getSigners().length; i < 8; i++) {
      const signer = ethers.Wallet.fromMnemonic(
        'test test test test test test test test test test test junk',
        `m/44'/60'/0'/0/${i}`
      ).connect(provider);
      signers.push(signer);
      await provider.send('hardhat_setBalance', [
        await signer.getAddress(),
        `0x${(1e22).toString(16)}`,
      ]);
    }
  });

  before('give owner permission to create pools', async () => {
    const [owner] = getSigners();
    await contracts.Core.addToFeatureFlagAllowlist(
      ethers.utils.formatBytes32String('createPool'),
      await owner.getAddress()
    );
  });

  return {
    provider: () => getProvider(),
    signers: () => [...getSigners(), ...signers],
    owner: () => getSigners()[0],
    systems: () => contracts,
  };
}

export function bootstrapWithSynth(name: string, token: string) {
  const r = createStakedPool(bootstrap(), bn(1000), bn(1000).div(10));

  let coreOwner: ethers.Signer, marketOwner: ethers.Signer;
  let marketId: BigNumber;
  let aggregator: AggregatorV3Mock;
  let contracts: Systems;

  before('identify contracts', () => {
    contracts = r.systems() as Systems;
  });

  before('identify market owner', async () => {
    [coreOwner, , marketOwner] = r.signers();
  });

  before('register synth', async () => {
    marketId = await contracts.SpotMarket.callStatic.createSynth(
      name,
      token,
      await marketOwner.getAddress()
    );
    await contracts.SpotMarket.createSynth(name, token, await marketOwner.getAddress());
  });

  before('configure market collateral supply cap', async () => {
    await contracts.Core.connect(coreOwner).configureMaximumMarketCollateral(
      marketId,
      contracts.CollateralMock.address,
      ethers.constants.MaxUint256
    );
  });

  before('setup buy and sell feeds', async () => {
    const result = await createOracleNode(
      r.signers()[0],
      ethers.utils.parseEther('900'),
      contracts.OracleManager
    );
    aggregator = result.aggregator;
    await contracts.SpotMarket.connect(marketOwner).updatePriceData(
      marketId,
      r.oracleNodeId(),
      result.oracleNodeId
    );
  });

  // add weight to market from pool

  before('delegate pool collateral to market', async () => {
    await r
      .systems()
      .Core.connect(coreOwner)
      .setPoolConfiguration(r.poolId, [
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
    systems: () => contracts,
    marketId: () => marketId,
    marketOwner: () => marketOwner,
    aggregator: () => aggregator,
    restore,
  };
}

export function bootstrapTraders(r: ReturnType<typeof bootstrapWithSynth>) {
  bootstrapStakers(r.systems, r.signers);

  let trader1: ethers.Signer, trader2: ethers.Signer;
  before('identify traders', () => {
    [, , , trader1, trader2] = r.signers();
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    trader1: () => trader1,
    trader2: () => trader2,
    restore,
  };
}

export const bn = (n: number) => wei(n).toBN();
