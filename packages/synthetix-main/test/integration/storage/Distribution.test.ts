import hre from 'hardhat';

import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { Contract, ethers } from 'ethers';
import { bootstrap } from '../bootstrap';
import { snapshotCheckpoint } from '../../utils';
import { wei } from '@synthetixio/wei';

const distUtils = {
  getActor: (id: string) => ethers.utils.formatBytes32String(id),
};

const bn = (n: number) => wei(n).toBN();
const hp = wei(10).pow(27);

describe.only('Distribution', async () => {
  const { systems, signers, provider } = bootstrap();
  const restore = snapshotCheckpoint(provider);
  let FakeDistributionModule: Contract;

  before('initialize fake distribution', async () => {
    FakeDistributionModule = systems().Core.connect(signers()[0]);
  });

  const actor1 = distUtils.getActor('1');
  const actor2 = distUtils.getActor('2');
  const actor3 = distUtils.getActor('3');

  describe('updateActorShares()', async () => {
    before('add shares', async () => {
      await FakeDistributionModule.Distribution_updateActorShares(actor1, 0);
      await FakeDistributionModule.Distribution_updateActorShares(actor2, 10);
      await FakeDistributionModule.Distribution_updateActorShares(actor3, 25);
    });

    it('returns proper shares', async () => {
      assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), 0);
      assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), 10);
      assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), 25);
    });

    it('returns proper total shares', async () => {
      assertBn.equal(await FakeDistributionModule.Distribution_get_totalShares(), 35);
    });

    describe('distributeValue()', async () => {
      before(restore);
      // updateActorShares() with distribution of value
      describe('when actors enter using shares and no value', async () => {
        describe('actor enters', async () => {
          before('add shares', async () => {
            await FakeDistributionModule.Distribution_updateActorShares(actor1, bn(1));
          });

          before('distribute', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(10));
          });

          it('has correct actor value', async () => {
            assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor1), bn(10));
          });
        });

        describe('2 actors enter', async () => {
          before('add shares', async () => {
            await FakeDistributionModule.Distribution_updateActorShares(actor2, bn(2));
            await FakeDistributionModule.Distribution_updateActorShares(actor3, bn(5));
          });

          it('has correct actor values', async () => {
            assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor2), bn(20));
            assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor3), bn(50));
          });
        });

        describe('distribute more value', async () => {
          before('distribute', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(10));
          });

          it('has correct actor values', async () => {
            // actor1: 1; actor2: 2; actor3: 5 === 8 shares
            const shareValue = bn(10).div(8);

            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor1),
              shareValue.add(bn(10)) // one share
            );
            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor2),
              shareValue.mul(2).add(bn(20)) // two shares
            );
            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor3),
              shareValue.mul(5).add(bn(50)) // two shares
            );
          });
        });

        describe('accumulateActor()', async () => {
          const previousActor1Value = 0;
          const previousActor2Value = bn(20);
          const previousActor3Value = bn(50);

          let currentActor1Value, currentActor2Value, currentActor3Value;

          it('actor1 has correct shares', async () => {
            currentActor1Value = await FakeDistributionModule.Distribution_getActorValue(actor1);
            assertBn.equal(
              await FakeDistributionModule.callStatic.Distribution_accumulateActor(actor1),
              currentActor1Value.sub(previousActor1Value)
            );
          });

          it('other actors have correct shares', async () => {
            currentActor2Value = await FakeDistributionModule.Distribution_getActorValue(actor2);
            currentActor3Value = await FakeDistributionModule.Distribution_getActorValue(actor3);

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

        describe('totalValue()', async () => {
          it('returns correct value', async () => {
            const actor1Value = await FakeDistributionModule.Distribution_getActorValue(actor1);
            const actor2Value = await FakeDistributionModule.Distribution_getActorValue(actor2);
            const actor3Value = await FakeDistributionModule.Distribution_getActorValue(actor3);

            assertBn.equal(
              await FakeDistributionModule.callStatic.Distribution_totalValue(),
              actor1Value.add(actor2Value).add(actor3Value)
            );
          });
        });

        describe('actor2 leaves', async () => {
          before('remove actor2 shares', async () => {
            await FakeDistributionModule.Distribution_updateActorShares(actor2, 0);
          });

          const shareValue = bn(10).add(bn(10).div(8));
          const actor1Value = shareValue; // 1 share
          const actor3Value = shareValue.mul(5); // 5 shares

          it('has correct actor values', async () => {
            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor1),
              actor1Value
            );
            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor3),
              actor3Value
            );

            // nothing for actor2
            assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor2), 0);
          });

          it('has correct total value', async () => {
            assertBn.equal(
              await FakeDistributionModule.Distribution_totalValue(),
              actor1Value.add(actor3Value)
            );
          });
        });

        describe('distribute more value', async () => {
          before('distribute', async () => {
            await FakeDistributionModule.Distribution_distributeValue(bn(60));
          });

          const shareValue = bn(10).add(bn(10).div(8)).add(bn(60).div(6)); // 10 + 10/8 + 60/6
          const actor1Value = shareValue; // 1 share
          const actor3Value = shareValue.mul(5); // 5 shares

          it('has correct actor values', async () => {
            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor1),
              actor1Value
            );
            assertBn.equal(
              await FakeDistributionModule.Distribution_getActorValue(actor3),
              actor3Value
            );

            // nothing for actor2
            assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor2), 0);
          });

          it('has correct total value', async () => {
            assertBn.equal(
              await FakeDistributionModule.Distribution_totalValue(),
              actor1Value.add(actor3Value)
            );
          });
        });
      });
    });
  });

  describe('updateActorValue()', async () => {
    describe('when actor has shares with no value', async () => {
      before(restore);
      before('add actor shares', async () => {
        await FakeDistributionModule.Distribution_updateActorShares(actor1, bn(10));
      });

      it('reverts on updating value', async () => {
        await assertRevert(
          FakeDistributionModule.Distribution_updateActorValue(actor1, bn(100)),
          'ZeroValuePerShare()'
        );
      });
    });

    describe('inconsistent distribution', async () => {
      before(restore);
      before('add shares', async () => {
        await FakeDistributionModule.Distribution_updateActorShares(actor1, bn(10));
        await FakeDistributionModule.Distribution_distributeValue(bn(100));
        await FakeDistributionModule.Distribution_accumulateActor(actor1); // lastActorValue set
      });

      it('reverts when updating value', async () => {
        await assertRevert(
          FakeDistributionModule.Distribution_updateActorValue(actor1, bn(50)),
          'InconsistentDistribution()'
        );
      });
    });

    // updateActorValue() with distribution
    describe('when actors enter with value', async () => {
      before(restore);

      let currentSharePrice = hp; // 1e23, initial price per share

      describe('actors enter', async () => {
        before('add value', async () => {
          await FakeDistributionModule.Distribution_updateActorValue(actor1, bn(50));
          await FakeDistributionModule.Distribution_updateActorValue(actor2, bn(150));
          await FakeDistributionModule.Distribution_updateActorValue(actor3, bn(250));
        });

        it('has correct actor shares', async () => {
          assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), bn(50));
          assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), bn(150));
          assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), bn(250));
        });

        it('has correct actor values', async () => {
          assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor1), bn(50));
          assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor2), bn(150));
          assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor3), bn(250));
        });

        it('returns proper total value', async () => {
          assertBn.equal(await FakeDistributionModule.Distribution_totalValue(), bn(450));
        });
      });

      describe('distributeValue(): value gets distributed to actors', async () => {
        const addedValue = wei(1000);
        before('distribute value', async () => {
          await FakeDistributionModule.Distribution_distributeValue(addedValue.toBN());
        });

        it('has correct actor values', async () => {
          const initialSharePrice = hp; // 1e27
          const sharePriceDelta = addedValue.mul(initialSharePrice).div(wei(450));
          currentSharePrice = initialSharePrice.add(sharePriceDelta);
          assertBn.equal(
            await FakeDistributionModule.Distribution_getActorValue(actor1),
            currentSharePrice.mul(50).div(hp).toBN()
          );
          assertBn.equal(
            await FakeDistributionModule.Distribution_getActorValue(actor2),
            currentSharePrice.mul(150).div(hp).toBN()
          );
          assertBn.equal(
            await FakeDistributionModule.Distribution_getActorValue(actor3),
            currentSharePrice.mul(250).div(hp).toBN()
          );
        });
      });

      describe('another actor enters with value', async () => {
        const actor4 = distUtils.getActor('4');
        const actor4Value = wei(500);
        before('add value', async () => {
          await FakeDistributionModule.Distribution_updateActorValue(actor4, actor4Value.toBN());
        });

        it('has correct actor shares', async () => {
          const expectedActorShares = actor4Value.mul(hp).div(currentSharePrice);
          assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor1), bn(50));
          assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor2), bn(150));
          assertBn.equal(await FakeDistributionModule.Distribution_getActorShares(actor3), bn(250));
          assertBn.equal(
            await FakeDistributionModule.Distribution_getActorShares(actor4),
            expectedActorShares.toBN()
          );
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

  // stress tests
  // describe('very high value per share');
  // describe('very low # of shares');
  // describe('very low amount distributed');

  describe('edge case scenarios', async () => {
    // very high value per share
    describe('high value per share', async () => {
      before(restore);
      before('add actors with small values', async () => {
        await FakeDistributionModule.Distribution_updateActorValue(actor1, wei(1, 10).toBN());
        await FakeDistributionModule.Distribution_updateActorValue(actor2, wei(2, 10).toBN());
      });

      before('distribute large amount of value', async () => {
        console.log(await FakeDistributionModule.Distribution_getActorValue(actor1));
        console.log(await FakeDistributionModule.Distribution_getActorValue(actor2));
        await FakeDistributionModule.Distribution_distributeValue(bn(1_00_00));
      });

      it('has correct actor values', async () => {
        // TODO
        assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor1), bn(10));
        assertBn.equal(await FakeDistributionModule.Distribution_getActorValue(actor2), bn(20));
      });
    });
  });
});
