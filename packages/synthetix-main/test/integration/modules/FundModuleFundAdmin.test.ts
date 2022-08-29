import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/dist/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/dist/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { findEvent } from '@synthetixio/core-utils/dist/utils/ethers/events';

import { bootstrap, bootstrapWithMockMarketAndFund } from '../bootstrap';
import { snapshotCheckpoint } from '../../utils';

describe.only('FundModule Admin', function () {
  const { 
    signers, 
    systems,
    provider,
    accountId,
    fundId,
    MockMarket,
    marketId,
    collateralAddress,
    depositAmount,
    restore
  } = bootstrapWithMockMarketAndFund();

  let owner: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer, user3: ethers.Signer;

  let Collateral: ethers.Contract, AggregatorV3Mock: ethers.Contract;

  const user2AccountId = 2;
  const user3AccountId = 3;

  const secondFundId = 3384692;

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  before('identify signers', async () => {
    [owner, user1, user2, user3] = signers();
  });

  describe('createFund()', async () => {
    before(restore);

    it('fails when fund already exists', async () => {
      
    })

    describe('success', async () => {

    })

    before('create a fund', async () => {
      await (
        await systems()
          .Core.connect(user1)
          .createFund(secondFundId, await user1.getAddress())
      ).wait();
    });
  
    it('fund is created', async () => {
      assert.equal(await systems().Core.ownerOf(secondFundId), await user1.getAddress());
    });
  })

  describe('setFundPosition()', async () => {

    let MockMarket2: ethers.Contract;
    let MockMarket3: ethers.Contract;

    const marketId2 = 2;
    const marketId3 = 3;

    before('set dummy markets', async () => {
      const factory = await hre.ethers.getContractFactory('MockMarket');
      const MockMarket2 = await factory.connect(owner).deploy();
      const MockMarket3 = await factory.connect(owner).deploy();

      await (await systems().Core.connect(owner).registerMarket(MockMarket2.address)).wait();
      await (await systems().Core.connect(owner).registerMarket(MockMarket3.address)).wait();
    });

    const restore = snapshotCheckpoint(provider);

    it('reverts when fund does not exist', async () => {
      await assertRevert(
        systems().Core.connect(user1).setFundPosition(834693286, [1], [1], [0, 0]),
        `FundNotFound("${834693286}")`,
        systems().Core
      );
    });

    it('reverts when not owner', async () => {
      await assertRevert(
        systems().Core.connect(user2).setFundPosition(fundId, [1], [1], [0, 0]),
        `Unauthorized("${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts with more weights than markets', async () => {
      await assertRevert(
        systems().Core.connect(owner).setFundPosition(fundId, [1], [1, 2], [0, 0]),
        'InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match")',
        systems().Core
      );
    });

    it('reverts with more markets than weights', async () => {
      await assertRevert(
        systems().Core.connect(owner).setFundPosition(fundId, [1, 2], [1], [0, 0]),
        'InvalidParameters("markets.length,weights.length,maxDebtShareValues.length", "must match")',
        systems().Core
      );
    });

    // in particular, this test needs to go here because we want to see it fail even when there is no liquidity to rebalance
    it('reverts when a marketId does not exist', async () => {
      await assertRevert(
        systems().Core.connect(owner).setFundPosition(fundId, [1, 2, 92197628], [1, 1, 1], [0, 0, 0]),
        'MarketNotFound("92197628")',
        systems().Core
      );
    });

    it('reverts when a marketId is duplicated', async () => {
      await assertRevert(
        systems().Core.connect(owner).setFundPosition(fundId, [1, 1], [1, 1], [0, 0]),
        'InvalidParameters("markets"',
        systems().Core
      );
    });

    it('default configuration sets market available liquidity', async () => {
      assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount);
    });

    describe('repeat fund sets position', async () => {
      before(restore);

      before('set fund position', async () => {
        await systems().Core.connect(owner).setFundPosition(fundId, [marketId()], [1], [One]);
      });

      it('sets market available liquidity', async () => {
        assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount);
      });

      describe('fund changes staking position to add another market', async () => {
        before('set fund position', async () => {
          await systems().Core.connect(owner).setFundPosition(fundId, [marketId(), marketId2], [1,3], [One, One]);
        });

        it('returns fund position correctly', async () => {
          assert.deepEqual(await systems().Core.getFundPosition(fundId), [
            [marketId(), ethers.BigNumber.from(marketId2)],
            [ethers.BigNumber.from(1), ethers.BigNumber.from(3)],
            [One, One]
          ]);
        });

        it('sets market available liquidity', async () => {
          assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount.div(4));
          assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId2), depositAmount.mul(3).div(4));
        });

        describe('market a little debt (below fund max)', () => {
          const debtAmount = Hundred.div(10);

          before('set market debt', async () => {
            await (await MockMarket().connect(owner).setBalance(debtAmount)).wait();
          });

          it('market gave the end vault debt', async () => {
            assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), debtAmount);
          });

          it('market still has available liquidity', async () => {
            assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount.div(4));
          });

          describe('exit the markets', () => {
            before('set fund position', async () => {
              await systems().Core.connect(owner).setFundPosition(fundId, [], [], []);
            });

            it('returns fund position correctly', async () => {
              assert.deepEqual(await systems().Core.getFundPosition(fundId), [[],[],[]]);
            });

            it('debt is still assigned', async () => {
              assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), debtAmount);
            });

            it('markets have same available liquidity', async () => {
              // marketId() gets to keep its available liquidity because when the market exited when it did it "committed"
              assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), debtAmount);

              // marketId2 never reported an increased balance so its liquidity is 0 as ever
              assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId2), 0);
            });
          })
        });
      });
    });

    describe('sets max debt below current debt share', async () => {
      before(restore);
      before('set fund position', async () => {
        await systems().Core.connect(owner).setFundPosition(fundId, [marketId()], [1], [One.mul(One.mul(-1)).div(depositAmount)]);
        console.log(await systems().Core.vaultCollateral(fundId, collateralAddress()));
      });

      // the second fund is here to test the calculation weighted average and to test fund entering/joining after debt shifts
      before('set second fund position position', async () => {
        await systems().Core.connect(user1).delegateCollateral(
          accountId,
          secondFundId,
          collateralAddress(),
          // deposit much more than the fundId pool so as to skew the limit much higher than what it set
          depositAmount,
          ethers.utils.parseEther('1')
        );

        await systems().Core.connect(user1).setFundPosition(secondFundId, [marketId()], [1], [One.mul(One).div(depositAmount).mul(2)]);
      });

      it('has only second fund market available liquidity', async () => {
        assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), One.mul(2));
      });

      describe('and then the market goes below max debt and the fund is bumped', async () => {
        before('buy into the market', async () => {
          // to go below max debt, we have to get user to invest in the market, and then reset the market

          // aquire USD from the zero fund
          await systems().Core.connect(user1).delegateCollateral(
            accountId,
            0,
            collateralAddress(),
            depositAmount,
            ethers.utils.parseEther('1')
          );

          await systems().Core.connect(user1).mintUSD(accountId, 0, collateralAddress(), Hundred);
          await systems().USD.connect(user1).approve(MockMarket().address, Hundred);
          await MockMarket().connect(user1).buySynth(Hundred);

          // "bump" the vault to get it to accept the position (in case there is a bug)
          await systems().Core.connect(user1).vaultDebt(fundId, collateralAddress());
        });

        it('has same amount liquidity available + the allowed amount by the vault', async () => {
          assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), One.mul(2).add(Hundred));

          // market hasn't reported any reduction in balance
          assertBn.equal(await systems().Core.connect(owner).marketTotalBalance(marketId()), 0);
        });

        it('did not change debt for connected vault', async () => {
          assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), 0);
        });

        describe('and then the market reports 0 balance', () => {
          before('set market', async () => {
            await MockMarket().connect(user1).setBalance(0);
            await systems().Core.connect(user1).vaultDebt(fundId, collateralAddress());
          });

          it('has accurate amount liquidity available', async () => {
            // should be exactly 201 (market1 99 + market2 2 + 100 deposit)
            assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), Hundred.mul(2).add(One));
          });

          it('vault isnt credited because it wasnt bumped early enough', async () => {
            assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), 0);
          });

          describe('and then the market reports 50 balance', () => {
            before('', async () => {
              await MockMarket().connect(user1).setBalance(Hundred.div(2));
            });

            it('has same amount liquidity available', async () => {
              assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), Hundred.mul(2).add(One));
            });

            it('vault is debted', async () => {
              // div 2 twice because the vault has half the debt of the pool
              assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), Hundred.div(2).div(2));
            });

            const restore = snapshotCheckpoint(provider);

            describe('and then the market reports balance above limit again', () => {
              before(restore);
              // testing the "soft" limit
              before('set market', async () => {
                console.log('second fund debt', await systems().Core.callStatic.vaultDebt(secondFundId, collateralAddress()));

                console.log('MARKET DPS', await systems().Core.connect(user1).callStatic.marketDebtPerShare(marketId()));
                console.log('NEEDED DPS', One.mul(One.mul(-1)).div(depositAmount));
                await MockMarket().connect(user1).setBalance(Hundred.mul(2));
                console.log('NEW MARKET DPS', await systems().Core.connect(user1).callStatic.marketDebtPerShare(marketId()));
                //await systems().Core.connect(user1).vaultDebt(fundId, collateralAddress());
                //await systems().Core.connect(user1).vaultDebt(fundId, collateralAddress());
                console.log('first fund debt', await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()));
                console.log('second fund debt', await systems().Core.callStatic.vaultDebt(secondFundId, collateralAddress()));
              });

              it('has same amount liquidity available + the allowed amount by the vault', async () => {
                assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), Hundred.mul(2).add(One));
              });

              it('vault assumes expected amount of debt', async () => {
                assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), Hundred.sub(One));
              });

              it('vault 2 assumes expected amount of debt', async () => {
                // vault 2 assumes the 1 dollar in debt that was not absorbed by the first fund
                // still below limit though
                assertBn.equal(await systems().Core.callStatic.vaultDebt(secondFundId, collateralAddress()), One);
              });
            });

            describe('and then the market reports balance above both pools limits', () => {
              before(restore);
              // testing the "soft" limit
              before('set market', async () => {
                console.log('MARKET DPS', await systems().Core.connect(user1).callStatic.marketDebtPerShare(marketId()));
                console.log('NEEDED DPS', One.mul(One).div(depositAmount).mul(2));
                console.log('MARKET COLLAT', await systems().Core.connect(user1).callStatic.marketCollateralValue(marketId()));
                await MockMarket().connect(user1).setBalance(Hundred.mul(1234));
                console.log('NEW MARKET DPS', await systems().Core.connect(user1).callStatic.marketDebtPerShare(marketId()));
                console.log('FUND OPS', await systems().Core.connect(user1).callStatic.getFundPosition(secondFundId));
                console.log('MARKET COLLAT', await systems().Core.connect(user1).callStatic.marketCollateralValue(marketId()));
              });

              it('has same amount liquidity available + the allowed amount by the vault', async () => {
                assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), Hundred.mul(2).add(One));
              });

              it('vault assumes expected amount of debt', async () => {
                assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), Hundred.sub(One));
              });

              it('vault 2 assumes expected amount of debt', async () => {
                assertBn.equal(await systems().Core.callStatic.vaultDebt(secondFundId, collateralAddress()), One.mul(2));
              });
            });
          });
        });
      })
    });
  });
});
