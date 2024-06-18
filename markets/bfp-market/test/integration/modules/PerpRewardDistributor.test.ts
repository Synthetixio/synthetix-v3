import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import {
  bn,
  genAddress,
  genBoolean,
  genBootstrap,
  genBytes32,
  genNumber,
  genOneOf,
} from '../../generators';
import { withExplicitEvmMine, withImpersonate } from '../../helpers';
import { IPerpRewardDistributorFactoryModule } from '../../../typechain-types/contracts/interfaces/IPerpRewardDistributorFactoryModule';
import { IPerpRewardDistributor__factory } from '../../../typechain-types/factories/contracts/interfaces/IPerpRewardDistributor__factory';

type CreateRewardDistributorArgs =
  IPerpRewardDistributorFactoryModule.CreatePerpRewardDistributorParametersStruct;

describe('PerpRewardDistributor', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, pool, owner, systems, provider, restore } = bs;

  beforeEach(restore);

  const createPerpRewardDistributor = async (args: CreateRewardDistributorArgs) => {
    const { BfpMarketProxy } = systems();
    const distributor =
      await BfpMarketProxy.connect(owner()).callStatic.createRewardDistributor(args);
    await withExplicitEvmMine(
      () => BfpMarketProxy.connect(owner()).createRewardDistributor(args),
      provider()
    );
    return IPerpRewardDistributor__factory.connect(distributor, provider());
  };

  describe('initialize', () => {
    it('should match passed params during initialize', async () => {
      const { CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      assertBn.equal(await PerpRewardDistributor.getPoolId(), args.poolId);
      assert.equal(await PerpRewardDistributor.callStatic.name(), args.name);
      assert.equal(await PerpRewardDistributor.callStatic.token(), args.token);

      const poolCollateralTypes = await PerpRewardDistributor.getPoolCollateralTypes();
      assert.deepEqual(poolCollateralTypes, args.collateralTypes);
    });

    it('should revert when payout token decimals not 18', async () => {
      const { BfpMarketProxy, CollateralMockD8 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD8.address,
      };

      await assertRevert(
        BfpMarketProxy.connect(owner()).createRewardDistributor(args),
        `InvalidParameter("payoutToken", "Token decimals expected to be 18")`
      );
    });
  });

  describe('setShouldFailPayout', () => {
    it('should set shouldFailPayout=true correctly', async () => {
      const { CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);
      await PerpRewardDistributor.connect(owner()).setShouldFailPayout(true);

      const hasPayoutProcessed = await PerpRewardDistributor.connect(owner()).callStatic.payout(
        bn(0),
        bn(0),
        genAddress(),
        genAddress(),
        bn(0)
      );
      assert.equal(hasPayoutProcessed, false);
    });

    it('should revert when not owner', async () => {
      const { CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      const from = traders()[0].signer;
      await assertRevert(
        PerpRewardDistributor.connect(from).setShouldFailPayout(genBoolean()),
        `Unauthorized("${await from.getAddress()}")`,
        systems().Core
      );
    });
  });

  describe('payout', () => {
    it('should not payout when setShouldFailPayout=true', async () => {
      const { CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const distributor = await createPerpRewardDistributor(args);
      await distributor.connect(owner()).setShouldFailPayout(true);

      const hasPayoutProcessed = await distributor
        .connect(owner())
        .callStatic.payout(bn(0), bn(0), genAddress(), genAddress(), bn(0));
      assert.equal(hasPayoutProcessed, false);
    });

    it('should revert when poolId does not match', async () => {
      const { CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      const invalidPoolId = genNumber(69420, 69999);
      await assertRevert(
        PerpRewardDistributor.connect(owner()).payout(
          bn(0),
          invalidPoolId,
          args.token,
          genAddress(),
          bn(0)
        ),
        `InvalidParameter("poolId", "Unexpected poolId")`,
        pool().collateral()
      );
    });

    it('should revert when not reward manager', async () => {
      const { Core, CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      const from = genOneOf(traders());
      await assertRevert(
        PerpRewardDistributor.connect(from.signer).payout(
          bn(0),
          args.poolId,
          args.token,
          genAddress(),
          bn(0)
        ),
        `Unauthorized("${await from.signer.getAddress()}")`,
        Core
      );
    });

    it('should revert when there are no reward tokens remaining', async () => {
      const { Core, CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      // Amount of payoutTokens to send (1 more than there actually is, zero).
      const amount = bn(1);

      await withImpersonate(bs, Core.address, async (signer) => {
        await assertRevert(
          PerpRewardDistributor.connect(signer).payout(
            bn(0),
            args.poolId,
            args.token,
            genAddress(),
            amount
          ),
          `InsufficientRewardBalance("${amount}", "0")`,
          PerpRewardDistributor
        );
      });
    });
  });

  describe('distributeReward', () => {
    it('should distribute after transfer', async () => {
      const { Core, BfpMarketProxy, CollateralMock, CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [CollateralMock.address],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      await Core.connect(owner()).registerRewardsDistributor(
        args.poolId,
        args.collateralTypes[0],
        PerpRewardDistributor.address
      );

      await withImpersonate(bs, BfpMarketProxy.address, async (signer) => {
        const amount = bn(genNumber(1, 100));
        await CollateralMockD18.mint(PerpRewardDistributor.address, amount);
        assertBn.equal(await CollateralMockD18.balanceOf(PerpRewardDistributor.address), amount);

        // One less than transferred - OK
        await PerpRewardDistributor.connect(signer).callStatic.distributeRewards(
          args.collateralTypes[0],
          amount.sub(bn(1))
        );
        // Exactly transferred - OK
        await PerpRewardDistributor.connect(signer).callStatic.distributeRewards(
          args.collateralTypes[0],
          amount
        );
        // One more than transferred - FAIL
        await assertRevert(
          PerpRewardDistributor.connect(signer).distributeRewards(
            args.collateralTypes[0],
            amount.add(bn(1))
          ),
          `InsufficientRewardBalance("${amount.add(bn(1))}", "${amount}")`,
          PerpRewardDistributor
        );
      });
    });

    it('should revert when attempting to distribute reward before a transfer', async () => {
      const { BfpMarketProxy, CollateralMockD18 } = systems();

      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress()],
        name: genBytes32(),
        token: CollateralMockD18.address,
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      await withImpersonate(bs, BfpMarketProxy.address, async (signer) => {
        const amount = bn(1);
        await assertRevert(
          PerpRewardDistributor.connect(signer).distributeRewards(args.collateralTypes[0], amount),
          `InsufficientRewardBalance("${amount}", "0")`,
          PerpRewardDistributor
        );
      });
    });
  });
});
