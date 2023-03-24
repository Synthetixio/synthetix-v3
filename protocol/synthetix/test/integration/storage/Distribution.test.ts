import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { wei } from '@synthetixio/wei';
import { BigNumber, Contract, ethers } from 'ethers';
import { bootstrap } from '../bootstrap';

const distUtils = {
  getActor: (id: string) => ethers.utils.formatBytes32String(id),
};

const bn = (n: number) => wei(n).toBN();

describe('Distribution', async () => {
  const { systems, signers, provider } = bootstrap();
  const restore = snapshotCheckpoint(provider);
  let FakeDistributionModule: Contract;

  before('initialize fake distribution', async () => {
    FakeDistributionModule = systems().Core.connect(signers()[0]);
  });

  const actor1 = distUtils.getActor('1');
  const actor2 = distUtils.getActor('2');
  const actor3 = distUtils.getActor('3');

  describe('setActorShares()', async () => {
    before('add shares', async () => {
      await FakeDistributionModule.Distribution_setActorShares(actor1, 0);
      await FakeDistributionModule.Distribution_setActorShares(actor2, 10);
      await FakeDistributionModule.Distribution_setActorShares(actor3, 25);
    });

    it('returns proper shares', async () => {
      assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), 0);
      assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), 10);
      assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), 25);
    });

    describe('distributeValue()', async () => {
      before(restore);

      describe('when actors enter using shares and no value', async () => {
        let pricePerShare: BigNumber;

        describe('actor enters', async () => {
          before('add shares', async () => {
            await FakeDistributionModule.Distribution_setActorShares(actor1, bn(1));
          });

          before('distribute', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(10));
          });

          it('has correct value per share', async () => {
            pricePerShare = bn(10);
            assertBn.equal(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare
            );
          });
        });

        describe('2 actors enter', async () => {
          before('add shares', async () => {
            await FakeDistributionModule.Distribution_setActorShares(actor2, bn(2));
            await FakeDistributionModule.Distribution_setActorShares(actor3, bn(5));
          });

          it('has correct actor shares', async () => {
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), bn(2));
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), bn(5));
          });

          it('has same value per share', async () => {
            assertBn.equal(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare
            );
          });
        });

        describe('distribute more value', async () => {
          before('distribute', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(10));
          });

          it('does not change actor shares', async () => {
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), bn(1));
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), bn(2));
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), bn(5));
          });

          it('has correct value per share', async () => {
            // actor1: 1; actor2: 2; actor3: 5 === 8 shares
            pricePerShare = bn(90).div(8); // 80 (previous total) + 10 (new total) = 90 / 8 (total shares)

            assertBn.equal(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare
            );
          });
        });

        describe('accumulateActor()', async () => {
          const previousActor1Value = 0; // actor1 did not accumulate after initial distribution
          const previousActor2Value = bn(2).mul(10); // 2 * 10
          const previousActor3Value = bn(5).mul(10); // 5 * 10

          it('actor1 has correct shares', async () => {
            const currentActor1Value = pricePerShare; // only 1 share
            assertBn.equal(
              await FakeDistributionModule.callStatic.Distribution_accumulateActor(actor1),
              currentActor1Value.sub(previousActor1Value)
            );
          });

          it('other actors have correct shares', async () => {
            const currentActor2Value = pricePerShare.mul(2);
            const currentActor3Value = pricePerShare.mul(5);

            assertBn.equal(
              await FakeDistributionModule.callStatic.Distribution_accumulateActor(actor2),
              currentActor2Value.sub(previousActor2Value)
            );
            assertBn.equal(
              await FakeDistributionModule.callStatic.Distribution_accumulateActor(actor3),
              currentActor3Value.sub(previousActor3Value)
            );
          });
        });

        describe('actor2 leaves', async () => {
          before('remove actor2 shares', async () => {
            await FakeDistributionModule.Distribution_setActorShares(actor2, 0);
          });

          it('has the same value per share', async () => {
            assertBn.equal(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare
            );
          });

          it('has correct actor shares', async () => {
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), bn(1));
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), 0);
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), bn(5));
          });
        });

        describe('distribute negative value', async () => {
          before('distribute', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(-60));
          });

          it('does not change actor shares', async () => {
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), bn(1));
            assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), bn(5));
          });

          it('has correct value per share', async () => {
            const actor2ValueBeforeLeaving = pricePerShare.mul(2);
            pricePerShare = bn(30).sub(actor2ValueBeforeLeaving).div(6); // 90 (previous total) - 60 (new total) - actor2ShareValue = 150 / 6 (total shares)
            assertBn.equal(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare
            );
          });
        });

        describe('distribute very large value', async () => {
          it('fails when distribution is too large', async () => {
            await assertRevert(
              FakeDistributionModule.Distribution_distributeValue(bn(1e18)),
              'OverflowInt256ToInt128()'
            );
          });
        });

        describe('distribute very low value', async () => {
          before(async () => {
            await FakeDistributionModule.Distribution_distributeValue(10); // Note: not bn(10) so super low
          });

          it('has correct value per share', async () => {
            // note the low value rounds down, so 10 / 6 = 1
            pricePerShare = BigNumber.from(10).div(6).add(pricePerShare); // 10 / 6 (total shares) + previous pricePerShare
            assertBn.equal(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare
            );
          });
        });

        describe('set very low number of shares to new actor', async () => {
          before('add new actor with low shares', async () => {
            await FakeDistributionModule.Distribution_setActorShares(actor2, 5); // welcome back actor2
          });

          before('distribute value', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(10));
          });

          it('has correct value per share', async () => {
            const totalShares = bn(6).add(1);
            const delta = wei(10).div(totalShares).toBN();

            pricePerShare = pricePerShare.add(delta);

            assertBn.near(
              await FakeDistributionModule.Distribution_getValuePerShare(),
              pricePerShare,
              1 // small deviation due to precision loss
            );
          });
        });
      });
    });
  });

  describe('distributeValue()', async () => {
    before(restore);

    it('fails when no shares', async () => {
      await assertRevert(
        FakeDistributionModule.Distribution_distributeValue(bn(100)),
        'EmptyDistribution()'
      );
    });
  });
});
