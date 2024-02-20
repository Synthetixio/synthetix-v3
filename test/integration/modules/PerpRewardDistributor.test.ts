import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../../bootstrap';
import { bn, genAddress, genBoolean, genBootstrap, genBytes32, genNumber, genOneOf } from '../../generators';
import { withExplicitEvmMine } from '../../helpers';
import { IPerpRewardDistributorFactoryModule } from '../../../typechain-types/contracts/interfaces/IPerpRewardDistributorFactoryModule';
import { IPerpRewardDistributor__factory } from '../../../typechain-types';

describe('PerpRewardDistributor', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, pool, owner, systems, provider, restore } = bs;

  beforeEach(restore);

  const createPerpRewardDistributor = async (
    args: IPerpRewardDistributorFactoryModule.CreatePerpRewardDistributorParametersStruct
  ) => {
    const { PerpMarketProxy } = systems();
    const distributor = await PerpMarketProxy.connect(owner()).callStatic.createRewardDistributor(args);
    await withExplicitEvmMine(() => PerpMarketProxy.connect(owner()).createRewardDistributor(args), provider());
    return IPerpRewardDistributor__factory.connect(distributor, provider());
  };

  describe('initialize', () => {
    it('should match passed params during initialize', async () => {
      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      assertBn.equal(await PerpRewardDistributor.getPoolId(), args.poolId);
      assert.equal(await PerpRewardDistributor.callStatic.name(), args.name);
      assert.equal(await PerpRewardDistributor.callStatic.token(), args.token);

      const poolCollateralTypes = await PerpRewardDistributor.getPoolCollateralTypes();
      assert.deepEqual(poolCollateralTypes, args.collateralTypes);
    });
  });

  describe('setShouldFailPayout', () => {
    it('should set shouldFailPayout=true correctly', async () => {
      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
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
      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      const from = traders()[0].signer;
      await assertRevert(
        PerpRewardDistributor.connect(from).setShouldFailPayout(genBoolean()),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });

  describe('payout', () => {
    it('should not payout when setShouldFailPayout=true', async () => {
      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
      };
      const distributor = await createPerpRewardDistributor(args);
      await distributor.connect(owner()).setShouldFailPayout(true);

      const hasPayoutProcessed = await distributor
        .connect(owner())
        .callStatic.payout(bn(0), bn(0), genAddress(), genAddress(), bn(0));
      assert.equal(hasPayoutProcessed, false);
    });

    it('should revert when poolId does not match', async () => {
      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      const invalidPoolId = genNumber(69420, 69999);
      await assertRevert(
        PerpRewardDistributor.connect(owner()).payout(bn(0), invalidPoolId, args.token, genAddress(), bn(0)),
        `InvalidParameter("poolId", "Unexpected poolId")`,
        PerpRewardDistributor
      );
    });

    it('should revert when not reward manager', async () => {
      const args = {
        poolId: pool().id,
        collateralTypes: [genAddress(), genAddress()],
        name: genBytes32(),
        token: genAddress(),
      };
      const PerpRewardDistributor = await createPerpRewardDistributor(args);

      const from = genOneOf(traders());
      await assertRevert(
        PerpRewardDistributor.connect(from.signer).payout(bn(0), args.poolId, args.token, genAddress(), bn(0)),
        `Unauthorized("${await from.signer.getAddress()}")`,
        PerpRewardDistributor
      );
    });
  });
});
