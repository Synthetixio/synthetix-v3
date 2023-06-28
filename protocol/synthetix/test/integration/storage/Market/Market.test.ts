import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { MockMarket } from '../../../../typechain-types/contracts/mocks/MockMarket';
import { bootstrap } from '../../bootstrap';

describe('Market', function () {
  const { systems, provider, signers } = bootstrap();

  const One = ethers.utils.parseEther('1');

  let owner: ethers.Signer;

  let FakeMarket: MockMarket;

  const fakeMarketId = 2929292;

  before('init', async () => {
    FakeMarket = await (await hre.ethers.getContractFactory('MockMarket')).deploy();
    await FakeMarket.deployed();

    [owner] = signers();

    await systems().Core.connect(owner).Market_set_marketAddress(fakeMarketId, FakeMarket.address);
  });

  const restore = snapshotCheckpoint(provider);

  describe('getReportedDebt()', async () => {
    before(restore);

    it('returns whatever the market sends', async () => {
      await FakeMarket.setReportedDebt(9876);

      assertBn.equal(await systems().Core.Market_getReportedDebt(fakeMarketId), 9876);
    });
  });

  describe('getLockedCreditCapacity()', async () => {
    before(restore);

    it('returns whatever the market sends', async () => {
      await FakeMarket.setLocked(1234);

      assertBn.equal(await systems().Core.Market_getLockedCreditCapacity(fakeMarketId), 1234);
    });
  });

  describe('totalDebt()', async () => {
    before(restore);

    it('returns market debt when no issuance', async () => {
      await FakeMarket.setReportedDebt(1000);

      assertBn.equal(await systems().Core.Market_totalDebt(fakeMarketId), 1000);
    });

    it('adds issuance to market debt', async () => {
      await FakeMarket.setReportedDebt(1000);
      await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, -10000);
      await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);

      assertBn.equal(await systems().Core.Market_totalDebt(fakeMarketId), -9000);
    });

    // not currently possible due to lack of code to set collateral lock
    it.skip('also subtracts from market debt', async () => {});
  });

  // not currently possible due to lack of code to set collateral lock
  describe.skip('getDepositedCollateralValue()', async () => {});

  describe('isCapacityLocked()', async () => {
    before(restore);

    it('unlocked when no locking', async () => {
      await FakeMarket.setLocked(0);
      await systems().Core.connect(owner).Market_set_creditCapacityD18(fakeMarketId, 0);

      assert.equal(await systems().Core.Market_isCapacityLocked(fakeMarketId), false);
    });
  });

  describe('adjustPoolShares()', async () => {
    before(restore);

    it('shows market is empty capacity before anyone adjusts in', async () => {
      assertBn.equal(await systems().Core.Market_get_creditCapacityD18(fakeMarketId), 0);
    });

    describe('pool enters', async () => {
      const fakePool1 = 82739;
      const fakePool2 = 68937;

      before('adjust', async () => {
        await systems()
          .Core.connect(owner)
          .Market_adjustPoolShares(fakeMarketId, fakePool1, 100, One.mul(2));
      });

      it('sets capacity', async () => {
        assertBn.equal(await systems().Core.Market_get_creditCapacityD18(fakeMarketId), 200);
      });

      it('sets amount of liquidity', async () => {
        assertBn.equal(await systems().Core.getMarketCollateral(fakeMarketId), 100);
      });

      it('calling rebalance assigns no debt', async () => {
        assertBn.equal(
          await systems().Core.callStatic.Market_rebalancePools(
            fakeMarketId,
            fakeMarketId,
            fakePool1,
            0,
            0
          ),
          0
        );
      });

      describe('when debt goes up a little bit', async () => {
        before('debt increase', async () => {
          await FakeMarket.setReportedDebt(10);
          await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
        });

        it('assigns appropriate debt', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool1,
              0,
              0
            ),
            10
          );
        });
      });

      describe('another pool enters', () => {
        before('adjust 2', async () => {
          await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 9999999);

          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool2, 200, One.mul(4));

          // pool fake market 1 to reset the counter
          // this is mostly sanity
          assertBn.equal(
            await systems()
              .Core.connect(owner)
              .callStatic.Market_adjustPoolShares(fakeMarketId, fakePool1, 100, One.mul(2)),
            10
          );

          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool1, 100, One.mul(2));
        });

        it('updates capacity', async () => {
          assertBn.equal(
            await systems().Core.Market_get_creditCapacityD18(fakeMarketId),
            980 // 200 from before + 3.99 * 200
          );
        });

        it('still has appropriate debts', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool1,
              0,
              0
            ),
            0
          );
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool2,
              0,
              0
            ),
            0
          );
        });

        describe('debt is assigned', () => {
          before('debt increase', async () => {
            await FakeMarket.setReportedDebt(40);
            await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
          });

          it('has new appropriate debts', async () => {
            assertBn.equal(
              await systems().Core.callStatic.Market_rebalancePools(
                fakeMarketId,
                fakeMarketId,
                fakePool1,
                0,
                0
              ),
              10 // counter should have been reset on adjust 2 before
            );
            assertBn.equal(
              await systems().Core.callStatic.Market_rebalancePools(
                fakeMarketId,
                fakeMarketId,
                fakePool2,
                0,
                0
              ),
              20
            );
          });

          describe('both pools leave', () => {
            before('adjusted to leave', async () => {
              await systems()
                .Core.connect(owner)
                .Market_distributeDebtToPools(fakeMarketId, 9999999);
              await systems()
                .Core.connect(owner)
                .Market_adjustPoolShares(fakeMarketId, fakePool1, 0, One.mul(1234));
              await systems()
                .Core.connect(owner)
                .Market_adjustPoolShares(fakeMarketId, fakePool2, 0, One.mul(4567));
            });

            it('capacity limited to however much was the debt at the time', async () => {
              assertBn.equal(await systems().Core.Market_get_creditCapacityD18(fakeMarketId), 40);
            });

            describe('increase debt again', () => {
              before('debt increase', async () => {
                await FakeMarket.setReportedDebt(40);
                await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
              });

              it('no debt for either markets', async () => {
                assertBn.equal(
                  await systems().Core.callStatic.Market_rebalancePools(
                    fakeMarketId,
                    fakeMarketId,
                    fakePool1,
                    0,
                    0
                  ),
                  0
                );
                assertBn.equal(
                  await systems().Core.callStatic.Market_rebalancePools(
                    fakeMarketId,
                    fakeMarketId,
                    fakePool2,
                    0,
                    0
                  ),
                  0
                );
              });
            });
          });
        });
      });
    });
  });

  describe('distributeDebtToPools()', () => {
    const fakePool1 = 29386;
    const fakePool2 = 34572;
    const fakePool3 = 92386;

    describe('maxIter', async () => {
      describe('moving out of range', async () => {
        before(restore);
        before('move out of range with three pools, limit 1', async () => {
          // adding them here in a random order
          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool2, 5, One.mul(8));
          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool3, 15, One.mul(10));
          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool1, 20, One.mul(4));

          await FakeMarket.setReportedDebt(1000000000);
          await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 1);

          // sanity
          assertBn.equal(
            await systems().Core.connect(owner).Market_get_creditCapacityD18(fakeMarketId),
            270
          );
        });

        it('debt is only partially moved', async () => {
          // all fake pools should have received their proportional
          // amount up to 4 * share amount, but not more than that
          assertBn.equal(
            await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
              fakeMarketId,
              fakePool1
            ),
            80
          );
          assertBn.equal(
            await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
              fakeMarketId,
              fakePool2
            ),
            20
          );
          assertBn.equal(
            await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
              fakeMarketId,
              fakePool3
            ),
            60
          );
        });

        it('capacity is unchanged', async () => {
          assertBn.equal(
            await systems().Core.connect(owner).Market_get_creditCapacityD18(fakeMarketId),
            270
          );
        });

        describe('call again', async () => {
          before('move out of range with three pools, limit 1', async () => {
            await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 1);
          });

          it('debt is moved further', async () => {
            // all fake pools should have received their proportional
            // amount up to 40, but not more than that
            assertBn.equal(
              await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                fakeMarketId,
                fakePool1
              ),
              80 // unchanged due to being kicked out
            );
            assertBn.equal(
              await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                fakeMarketId,
                fakePool2
              ),
              40
            );
            assertBn.equal(
              await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                fakeMarketId,
                fakePool3
              ),
              120
            );
          });

          it('capacity is unchanged', async () => {
            assertBn.equal(
              await systems().Core.connect(owner).Market_get_creditCapacityD18(fakeMarketId),
              270
            );
          });

          describe('last pool removed', async () => {
            before('move out of range with three pools, limit 1', async () => {
              await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 1);
            });

            it('debt is moved to the end, and no further', async () => {
              // all fake pools should have received their fully allocated debt amounts
              assertBn.equal(
                await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                  fakeMarketId,
                  fakePool1
                ),
                80
              );
              assertBn.equal(
                await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                  fakeMarketId,
                  fakePool2
                ),
                40
              );
              assertBn.equal(
                await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                  fakeMarketId,
                  fakePool3
                ),
                150
              );
            });
          });
        });
      });

      describe('moving into range', async () => {
        before(restore);

        before('move into range with three pools, limit 1', async () => {
          // adding them here in a random order
          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool2, 5, One.mul(-8));
          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool3, 15, One.mul(-4));
          await systems()
            .Core.connect(owner)
            .Market_adjustPoolShares(fakeMarketId, fakePool1, 20, One.mul(-10));

          await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, -1000);

          // sanity
          assertBn.equal(
            await systems().Core.connect(owner).Market__testOnly_inRangePools(fakeMarketId),
            0
          );
        });

        before('distribute down', async () => {
          await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 1);
        });

        it('debt per share is at the point where the pool was added', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_getDebtPerShare(fakeMarketId),
            One.mul(-4)
          );
        });

        it('debt is only partially moved', async () => {
          // none of the pools have received any debt allocation
          // becuase it only just now entered the range
          assertBn.equal(
            await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
              fakeMarketId,
              fakePool1
            ),
            0
          );
          assertBn.equal(
            await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
              fakeMarketId,
              fakePool2
            ),
            0
          );
          assertBn.equal(
            await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
              fakeMarketId,
              fakePool3
            ),
            0
          );
        });

        describe('call again', async () => {
          before('move into range with limit 1', async () => {
            await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 1);
          });

          it('debt per share is at the point where the pool was added', async () => {
            assertBn.equal(
              await systems().Core.callStatic.Market_getDebtPerShare(fakeMarketId),
              One.mul(-8)
            );
          });

          it('debt is moved as far as possible', async () => {
            assertBn.equal(
              await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                fakeMarketId,
                fakePool1
              ),
              0
            );
            assertBn.equal(
              await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                fakeMarketId,
                fakePool2
              ),
              0
            );
            assertBn.equal(
              await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                fakeMarketId,
                fakePool3
              ),
              -60
            );
          });

          describe('call again', async () => {
            before('move into range with limit 1', async () => {
              await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 1);
            });

            it('debt per share is at the point where the pool was added', async () => {
              assertBn.equal(
                await systems().Core.callStatic.Market_getDebtPerShare(fakeMarketId),
                One.mul(-10)
              );
            });

            it('debt is moved as far as possible', async () => {
              assertBn.equal(
                await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                  fakeMarketId,
                  fakePool1
                ),
                0
              );
              assertBn.equal(
                await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                  fakeMarketId,
                  fakePool2
                ),
                -10
              );
              assertBn.equal(
                await systems().Core.callStatic.Market__testOnly_getOutstandingDebt(
                  fakeMarketId,
                  fakePool3
                ),
                -90
              );
            });
          });
        });
      });
    });

    describe('two pools join starting in range', () => {
      before(restore);

      before('setup', async () => {
        // adding them here in a random order
        await systems()
          .Core.connect(owner)
          .Market_adjustPoolShares(fakeMarketId, fakePool2, 5, One.mul(8));
        await systems()
          .Core.connect(owner)
          .Market_adjustPoolShares(fakeMarketId, fakePool1, 15, One.mul(4));
      });

      describe('market debt increases within range', async () => {
        before('debt increases', async () => {
          await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, 20);
          await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
        });

        it('debt is moved as far as possible', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool1,
              0,
              0
            ),
            15
          );
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool2,
              0,
              0
            ),
            5
          );
        });
      });

      describe('market debt increases to out of range', async () => {
        before('debt increases', async () => {
          await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, 10000000);
          await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
        });

        it('debt is moved as far as possible', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool1,
              0,
              0
            ),
            60
          );
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool2,
              0,
              0
            ),
            40
          );
        });
      });
    });

    describe('two pools connect starting out of range', async () => {
      before(restore);

      before('setup', async () => {
        // add an extra pool to absorb liquidity
        await systems()
          .Core.connect(owner)
          .Market_adjustPoolShares(fakeMarketId, fakePool2 + 1, 20, One.mul(1000000));
        await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, 1000);
        await systems().Core.connect(owner).Market_distributeDebtToPools(fakeMarketId, 99999);

        // adding them here in a random order
        await systems()
          .Core.connect(owner)
          .Market_adjustPoolShares(fakeMarketId, fakePool2, 5, One.mul(8));
        await systems()
          .Core.connect(owner)
          .Market_adjustPoolShares(fakeMarketId, fakePool1, 15, One.mul(4));
      });

      describe('market debt decreases still out of range', async () => {
        before('debt increases', async () => {
          await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, 500);
          await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
        });

        it('debt is moved as far as possible', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool1,
              0,
              0
            ),
            0
          );
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool2,
              0,
              0
            ),
            0
          );
        });
      });

      describe('market debt increases to in range for both', async () => {
        before('debt increases', async () => {
          await systems().Core.connect(owner).Market_set_netIssuanceD18(fakeMarketId, 0);
          await systems().Core.Market_distributeDebtToPools(fakeMarketId, 999999999);
        });

        it('half of the debt remaining debt is taken from the extra market that was in the whole time', async () => {
          assertBn.equal(
            await systems().Core.callStatic.Market_rebalancePools(
              fakeMarketId,
              fakeMarketId,
              fakePool2 + 1,
              0,
              0
            ),
            50
          );
        });
      });
    });
  });
});
