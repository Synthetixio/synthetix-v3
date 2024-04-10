import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { Proxy as OracleManagerProxy } from '@synthetixio/oracle-manager/test/generated/typechain';
import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { MockMarket } from '../../typechain-types';
import { createStakedPool } from '../common';

import type { AccountProxy, CoreProxy, USDProxy, CollateralMock } from '../generated/typechain';
const MARKET_FEATURE_FLAG = ethers.utils.formatBytes32String('registerMarket');

export interface Proxies {
  AccountProxy: AccountProxy;
  CoreProxy: CoreProxy;
  USDProxy: USDProxy;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
  ['oracle_manager.Proxy']: OracleManagerProxy;
}

export interface Systems {
  Account: AccountProxy;
  Core: CoreProxy;
  USD: USDProxy;
  CollateralMock: CollateralMock;
  Collateral2Mock: CollateralMock;
  OracleManager: OracleManagerProxy;
}

const { getProvider, getSigners, getContract, createSnapshot } = coreBootstrap<Proxies>({
  cannonfile: 'cannonfile.test.toml',
});

const restoreSnapshot = createSnapshot();

export function bootstrap() {
  let systems: Systems;

  before('load system proxies', function () {
    systems = {
      Account: getContract('AccountProxy'),
      Core: getContract('CoreProxy'),
      USD: getContract('USDProxy'),
      OracleManager: getContract('oracle_manager.Proxy'),
      CollateralMock: getContract('CollateralMock'),
      Collateral2Mock: getContract('Collateral2Mock'),
    } as Systems;
  });

  before(restoreSnapshot);

  /*
   * Monkey patch to implicitily call to txRequest.wait() method on all write operations.
   * This is necessary so we are sure that on each test case we don't leave pending txs.
   */
  const signers = () => {
    const results = getSigners();

    for (const signer of results) {
      const originalSendTransaction = signer.sendTransaction.bind(signer);
      signer.sendTransaction = async function sendTransactionWithWait(...params) {
        const response = await originalSendTransaction(...params);
        await response.wait();
        return response;
      };
    }

    return results;
  };

  return {
    provider: () => getProvider(),
    signers,
    owner: () => signers()[0],
    systems: () => systems,
  };
}

export function bootstrapWithStakedPool() {
  return createStakedPool(bootstrap());
}

export function bootstrapWithMockMarketAndPool() {
  const r = bootstrapWithStakedPool();

  let MockMarket: MockMarket;
  let marketId: ethers.BigNumber;

  before('give owner permission to create markets', async () => {
    await r
      .systems()
      .Core.addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, await r.owner().getAddress());
  });

  before('deploy and connect fake market', async () => {
    const [owner, user1] = r.signers();

    const factory = await hre.ethers.getContractFactory('MockMarket');

    MockMarket = await factory.connect(owner).deploy();

    // give user1 permission to register the market
    await r
      .systems()
      .Core.connect(owner)
      .addToFeatureFlagAllowlist(MARKET_FEATURE_FLAG, await user1.getAddress());

    marketId = await r.systems().Core.connect(user1).callStatic.registerMarket(MockMarket.address);

    await r.systems().Core.connect(user1).registerMarket(MockMarket.address);

    await MockMarket.connect(owner).initialize(
      r.systems().Core.address,
      marketId,
      ethers.utils.parseEther('1')
    );

    await r
      .systems()
      .Core.connect(owner)
      .setPoolConfiguration(r.poolId, [
        {
          marketId: marketId,
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('1'),
        },
      ]);

    await r
      .systems()
      .Core.connect(owner)
      .setPoolCollateralConfiguration(r.poolId, r.collateralAddress(), {
        collateralLimitD18: bn(1000000000),
        issuanceRatioD18: bn(1),
      });
  });

  const restore = snapshotCheckpoint(r.provider);

  return {
    ...r,
    MockMarket: () => MockMarket,
    marketId: () => marketId,
    restore,
  };
}

export const bn = (n: number) => wei(n).toBN();
