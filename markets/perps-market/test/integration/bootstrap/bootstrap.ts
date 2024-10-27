import { CoreProxy, USDProxy } from '@synthetixio/main/test/generated/typechain';
import { CollateralMock } from '@synthetixio/main/typechain-types';
import { Proxy as OracleManagerProxy } from '@synthetixio/oracle-manager/test/generated/typechain';
import { coreBootstrap } from '@synthetixio/core-utils/utils/bootstrap/tests';
import { bootstrapSynthMarkets, SynthArguments } from '@synthetixio/spot-market/test/common';
import {
  SpotMarketProxy,
  SynthRouter,
  TrustedMulticallForwarder,
} from '@synthetixio/spot-market/test/generated/typechain';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { AccountProxy, FeeCollectorMock, PerpsMarketProxy } from '../../generated/typechain';
import {
  bootstrapPerpsMarkets,
  bootstrapTraders,
  createRewardsDistributor,
  PerpsMarketData,
} from './';
import { createKeeperCostNode } from './createKeeperCostNode';
import { MockGasPriceNode } from '../../../typechain-types/contracts/mocks/MockGasPriceNode';
import { MockPythERC7412Wrapper } from '../../../typechain-types/contracts/mocks/MockPythERC7412Wrapper';

type Proxies = {
  ['synthetix.CoreProxy']: CoreProxy;
  ['synthetix.USDProxy']: USDProxy;
  ['synthetix.CollateralMock']: CollateralMock;
  ['synthetix.oracle_manager.Proxy']: OracleManagerProxy;
  ['spotMarket.SpotMarketProxy']: SpotMarketProxy;
  PerpsMarketProxy: PerpsMarketProxy;
  AccountProxy: AccountProxy;
  ['spotMarket.SynthRouter']: SynthRouter;
  ['synthetix.trusted_multicall_forwarder.TrustedMulticallForwarder']: TrustedMulticallForwarder;
  ['MockPythERC7412Wrapper']: MockPythERC7412Wrapper;
  ['FeeCollectorMock']: FeeCollectorMock;
};

export type Systems = {
  SpotMarket: SpotMarketProxy;
  Core: CoreProxy;
  USD: USDProxy;
  CollateralMock: CollateralMock;
  MockPythERC7412Wrapper: MockPythERC7412Wrapper;
  OracleManager: OracleManagerProxy;
  PerpsMarket: PerpsMarketProxy;
  Account: AccountProxy;
  TrustedMulticallForwarder: TrustedMulticallForwarder;
  FeeCollectorMock: FeeCollectorMock;
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
      TrustedMulticallForwarder: getContract(
        'synthetix.trusted_multicall_forwarder.TrustedMulticallForwarder'
      ),
      PerpsMarket: getContract('PerpsMarketProxy'),
      Account: getContract('AccountProxy'),
      MockPythERC7412Wrapper: getContract('MockPythERC7412Wrapper'),
      FeeCollectorMock: getContract('FeeCollectorMock'),
      Synth: (address: string) => getContract('spotMarket.SynthRouter', address),
    };
  });

  before('set snxUSD limit to max', async () => {
    // set max collateral amt for snxUSD to maxUINT
    await contracts.PerpsMarket.connect(getSigners()[0]).setCollateralConfiguration(
      0, // snxUSD
      ethers.constants.MaxUint256,
      0, // upperLimitDiscount
      0, // lowerLimitDiscount
      0 // discountScalar
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
  synthMarkets: (SynthArguments[number] & {
    upperLimitDiscount?: ethers.BigNumber;
    lowerLimitDiscount?: ethers.BigNumber;
    discountScalar?: ethers.BigNumber;
  })[];
  perpsMarkets: PerpsMarketData;
  traderAccountIds: Array<number>;
  liquidationGuards?: {
    minLiquidationReward: ethers.BigNumber;
    minKeeperProfitRatioD18: ethers.BigNumber;
    maxLiquidationReward: ethers.BigNumber;
    maxKeeperScalingRatioD18: ethers.BigNumber;
  };
  interestRateParams?: {
    lowUtilGradient: ethers.BigNumber;
    gradientBreakpoint: ethers.BigNumber;
    highUtilGradient: ethers.BigNumber;
  };
  maxPositionsPerAccount?: ethers.BigNumber;
  maxCollateralsPerAccount?: ethers.BigNumber;
  collateralLiquidateRewardRatio?: ethers.BigNumber;
  skipKeeperCostOracleNode?: boolean;
  skipRegisterDistributors?: boolean;
};

export function bootstrapMarkets(data: BootstrapArgs) {
  const chainStateWithPerpsMarkets = bootstrapPerpsMarkets(data.perpsMarkets, undefined);

  const { synthMarkets, marketOwner } = bootstrapSynthMarkets(
    data.synthMarkets,
    chainStateWithPerpsMarkets
  );

  const {
    systems,
    signers,
    provider,
    owner,
    perpsMarkets,
    poolId,
    collateralAddress,
    superMarketId,
    staker,
  } = chainStateWithPerpsMarkets;
  const { trader1, trader2, trader3, keeper } = bootstrapTraders({
    systems,
    signers,
    provider,
    owner,
    accountIds: data.traderAccountIds,
  });

  let keeperCostOracleNode: MockGasPriceNode;

  before('create perps gas usage nodes', async () => {
    if (data.skipKeeperCostOracleNode) {
      return;
    }

    const results = await createKeeperCostNode(owner(), systems().OracleManager);
    const keeperCostNodeId = results.keeperCostNodeId;
    keeperCostOracleNode = results.keeperCostNode;

    await systems().PerpsMarket.connect(owner()).updateKeeperCostNodeId(keeperCostNodeId);
  });

  before('set pool config', async () => {
    const synthMarketConfigs = synthMarkets().map((s) => ({
      marketId: s.marketId(),
      weightD18: ethers.utils.parseEther('1'),
      maxDebtShareValueD18: ethers.utils.parseEther('1'),
    }));
    await systems()
      .Core.connect(owner())
      .setPoolConfiguration(poolId, [
        {
          marketId: superMarketId(),
          weightD18: ethers.utils.parseEther('1'),
          maxDebtShareValueD18: ethers.utils.parseEther('1'),
        },
        ...synthMarketConfigs,
      ]);
  });

  // auto set all synth markets collaterals to max
  before('set collateral config', async () => {
    for (const [i, { marketId, synthAddress }] of synthMarkets().entries()) {
      const { upperLimitDiscount, lowerLimitDiscount, discountScalar } = data.synthMarkets[i];

      await systems()
        .PerpsMarket.connect(owner())
        .setCollateralConfiguration(
          marketId(),
          ethers.constants.MaxUint256,
          upperLimitDiscount || bn(0),
          lowerLimitDiscount || bn(0),
          discountScalar || bn(0)
        );

      await systems()
        .Core.connect(owner())
        .configureMaximumMarketCollateral(
          chainStateWithPerpsMarkets.superMarketId(),
          synthAddress(),
          ethers.constants.MaxUint256
        );
    }
  });

  before('set max positions and colltaterals per account', async () => {
    const { maxPositionsPerAccount, maxCollateralsPerAccount } = data;
    await systems()
      .PerpsMarket.connect(owner())
      .setPerAccountCaps(
        maxPositionsPerAccount ? maxPositionsPerAccount : 100000,
        maxCollateralsPerAccount ? maxCollateralsPerAccount : 100000
      );
  });

  before('set reward distributor', async () => {
    const { collateralLiquidateRewardRatio } = data;
    await systems()
      .PerpsMarket.connect(owner())
      .setCollateralLiquidateRewardRatio(
        collateralLiquidateRewardRatio ? collateralLiquidateRewardRatio : 0 // set to zero means no rewards based on collateral only
      );

    if (!data.skipRegisterDistributors) {
      // Deploy and register a new distributor for each collateral
      for (const { marketId, synthAddress } of synthMarkets()) {
        // Deploy the new rewards distributor
        const distributorAddress = await createRewardsDistributor(
          owner(),
          systems().Core,
          systems().PerpsMarket,
          poolId,
          collateralAddress(),
          synthAddress(),
          18,
          marketId()
        );

        await systems()
          .PerpsMarket.connect(owner())
          .registerDistributor(synthAddress(), distributorAddress, marketId(), [
            collateralAddress(),
          ]);
      }
    }
  });

  const { liquidationGuards } = data;
  if (liquidationGuards) {
    before('set liquidation guards', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setKeeperRewardGuards(
          liquidationGuards.minLiquidationReward,
          liquidationGuards.minKeeperProfitRatioD18,
          liquidationGuards.maxLiquidationReward,
          liquidationGuards.maxKeeperScalingRatioD18
        );
    });
  }

  const { interestRateParams } = data;
  if (interestRateParams) {
    before('set interest rate params', async () => {
      await systems()
        .PerpsMarket.connect(owner())
        .setInterestRateParameters(
          interestRateParams.lowUtilGradient,
          interestRateParams.gradientBreakpoint,
          interestRateParams.highUtilGradient
        );
    });
  }

  return {
    staker,
    systems,
    signers,
    provider,
    trader1,
    trader2,
    trader3,
    keeper,
    owner,
    perpsMarkets,
    keeperCostOracleNode: () => keeperCostOracleNode,
    synthMarkets,
    superMarketId,
    synthMarketOwner: marketOwner,
    poolId,
  };
}

export const bn = (n: number) => wei(n).toBN();
export const toNum = (n: ethers.BigNumber) => Number(ethers.utils.formatEther(n));
