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
    fundId,
    MockMarket,
    marketId,
    collateralAddress,
    depositAmount,
    restore
  } = bootstrapWithMockMarketAndFund();

  let owner: ethers.Signer, fundAdmin: ethers.Signer, user2: ethers.Signer, user3: ethers.Signer;

  let Collateral: ethers.Contract, AggregatorV3Mock: ethers.Contract;

  const user2AccountId = 2;
  const user3AccountId = 3;

  const secondFundId = 3384692;

  const One = ethers.utils.parseEther('1');
  const Hundred = ethers.utils.parseEther('100');

  before('identify signers', async () => {
    [owner, fundAdmin, user2, user3] = signers();
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
          .Core.connect(fundAdmin)
          .createFund(secondFundId, await fundAdmin.getAddress())
      ).wait();
    });
  
    it('fund is created', async () => {
      assert.equal(await systems().Core.ownerOf(secondFundId), await fundAdmin.getAddress());
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
        systems().Core.connect(fundAdmin).setFundPosition(834693286, [1], [1], [0, 0]),
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
      console.log(await systems().Core.ownerOf(fundId));
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
        systems().Core.connect(owner).setFundPosition(fundId, [1, 92197628, 2], [1, 1, 1], [0, 0, 0]),
        'MarketNotFound("92197628")',
        systems().Core
      );
    });

    it('default configuration sets market available liquidity', async () => {
      assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount);
    });

    describe('repeat fund sets position', async () => {
      before('set fund position', async () => {
        await systems().Core.connect(owner).setFundPosition(fundId, [marketId()], [1], [One]);
      });

      it('sets market available liquidity', async () => {
        assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount);
      });

      describe('fund changes staking position to add another market', async () => {
        before('set fund position', async () => {
          await systems().Core.connect(owner).setFundPosition(fundId, [marketId2, marketId()], [3,1], [One, One]);
        });

        it('returns fund position correctly', async () => {
          assert.deepEqual(await systems().Core.getFundPosition(fundId), [[ethers.BigNumber.from(marketId2), marketId()],[ethers.BigNumber.from(3), ethers.BigNumber.from(1)],[One, One]]);
        });

        it('sets market available liquidity', async () => {
          assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount.div(4));
          assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId2), depositAmount.mul(3).div(4));
        });

        describe('market commits balance that goes above fund max', () => {
          const debtAmount = Hundred.div(10);

          before('set market debt', async () => {
            await MockMarket().connect(owner).setBalance(debtAmount);
          });

          it('market gave the end vault debt', async () => {
            assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), debtAmount);
          });

          it('market still has available liquidity', async () => {
            assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), depositAmount.div(4));
          });

          describe('exit the markets', () => {
            before('set fund position', async () => {
              console.log(await systems().Core.connect(owner).marketCollateralValue(marketId()));
              await systems().Core.connect(owner).setFundPosition(fundId, [], [], []);
              console.log(await systems().Core.connect(owner).marketCollateralValue(marketId()));
            });

            it('returns fund position correctly', async () => {
              assert.deepEqual(await systems().Core.getFundPosition(fundId), [[],[],[]]);
            });

            it('debt is still assigned', async () => {
              assertBn.equal(await systems().Core.callStatic.vaultDebt(fundId, collateralAddress()), debtAmount);
            });

            it('markets have 0 available liquidity', async () => {
              assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId()), 0);
              assertBn.equal(await systems().Core.connect(owner).marketLiquidity(marketId2), 0);
            });
          })
        });
      });

      describe('additional fund joins the party', async () => {

      });
    });

    /*describe('when multiple funds and markets exist', async () => {
      before('add second collateral', async () => {
        let factory;

        factory = await hre.ethers.getContractFactory('CollateralMock');
        Collateral = await factory.connect(owner).deploy();

        await (await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)).wait();

        factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
        AggregatorV3Mock = await factory.connect(owner).deploy();

        await (await AggregatorV3Mock.connect(owner).mockSetCurrentPrice(1)).wait();

        await (
          await systems()
            .Core.connect(owner)
            .adjustCollateralType(Collateral.address, AggregatorV3Mock.address, 400, 200, 0, true)
        ).wait();
      });

      before('mint some account tokens', async () => {
        await (await systems().Core.connect(user2).createAccount(user2AccountId)).wait();
        await (await systems().Core.connect(user3).createAccount(user3AccountId)).wait();
      });

      before('mint some collateral to the user', async () => {
        await (await Collateral.mint(await user2.getAddress(), Hundred)).wait();
        await (await Collateral.mint(await user3.getAddress(), Hundred)).wait();
      });

      before('approve systems().Core to operate with the user collateral', async () => {
        await (
          await Collateral.connect(user2).approve(systems().Core.address, ethers.constants.MaxUint256)
        ).wait();
        await (
          await Collateral.connect(user3).approve(systems().Core.address, ethers.constants.MaxUint256)
        ).wait();
      });

      before('stake some collateral', async () => {
        await (await systems().Core.connect(user2).stake(2, Collateral.address, Hundred)).wait();
        await (await systems().Core.connect(user2).stake(2, Collateral.address, Hundred)).wait();
      });

      describe('')
  
        before('adjust fund positions', async () => {
          const tx = await systems()
            .Core.connect(fundAdmin)
            .setFundPosition(1, [1, 2], [1, 1], [0, 0]);
          receipt = await tx.wait();
        });
  
        it('emitted an event', async () => {
          const event = findEvent({ receipt, eventName: 'FundPositionSet' });
  
          assert.equal(event.args.executedBy, await fundAdmin.getAddress());
          assertBn.equal(event.args.fundId, 1);
          assert.equal(event.args.markets.length, 2);
          assert.equal(event.args.weights.length, 2);
          assertBn.equal(event.args.markets[0], 1);
          assertBn.equal(event.args.markets[1], 2);
          assertBn.equal(event.args.weights[0], 1);
          assertBn.equal(event.args.weights[1], 1);
        });
  
        it('is created', async () => {
          const [markets, weights] = await systems().Core.getFundPosition(1);
          assert.equal(markets.length, 2);
          assert.equal(weights.length, 2);
          assertBn.equal(markets[0], 1);
          assertBn.equal(markets[1], 2);
          assertBn.equal(weights[0], 1);
          assertBn.equal(weights[1], 1);
        });
  
        describe('when operating with the fund', async () => {
          //
          describe('when delegting collateral to a fund', async () => {
            let liquidityItemId: ethers.BigNumber;
  
            before('delegate some collateral', async () => {
              const tx = await systems()
                .Core.connect(user2)
                .delegateCollateral(1, 1, Collateral.address, 10, ethers.utils.parseEther('1'));
              receipt = await tx.wait();
            });
  
            it('emitted a DelegationUpdated event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'DelegationUpdated',
              });
              liquidityItemId = event.args.liquidityItemId;
  
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.accountId, 1);
              assertBn.equal(event.args.amount, 10);
              assertBn.equal(event.args.leverage, ethers.utils.parseEther('1'));
              assert.equal(event.args.collateralType, Collateral.address);
            });
  
            describe('when adding to the same liquidityId', async () => {
              before('delegate some collateral', async () => {
                const tx = await systems()
                  .Core.connect(user2)
                  .delegateCollateral(1, 1, Collateral.address, 20, ethers.utils.parseEther('1'));
                receipt = await tx.wait();
              });
  
              it('emitted a DelegationUpdated event', async () => {
                const event = findEvent({
                  receipt,
                  eventName: 'DelegationUpdated',
                });
  
                assert.equal(event.args.liquidityItemId, liquidityItemId);
                assertBn.equal(event.args.fundId, 1);
                assertBn.equal(event.args.accountId, 1);
                assertBn.equal(event.args.amount, 20);
                assertBn.equal(event.args.leverage, ethers.utils.parseEther('1'));
                assert.equal(event.args.collateralType, Collateral.address);
              });
            });
  
            describe('when decreasing from to same liquidityId', async () => {
              before('delegate some collateral', async () => {
                const tx = await systems()
                  .Core.connect(user2)
                  .delegateCollateral(1, 1, Collateral.address, 1, ethers.utils.parseEther('1'));
                receipt = await tx.wait();
              });
  
              it('emitted a DelegationUpdated event', async () => {
                const event = findEvent({
                  receipt,
                  eventName: 'DelegationUpdated',
                });
  
                assert.equal(event.args.liquidityItemId, liquidityItemId);
                assertBn.equal(event.args.fundId, 1);
                assertBn.equal(event.args.accountId, 1);
                assertBn.equal(event.args.amount, 1);
                assertBn.equal(event.args.leverage, ethers.utils.parseEther('1'));
                assert.equal(event.args.collateralType, Collateral.address);
              });
            });
  
            describe('when removing liquidityId', async () => {
              before('delegate some collateral', async () => {
                const tx = await systems()
                  .Core.connect(user2)
                  .delegateCollateral(1, 1, Collateral.address, 0, ethers.utils.parseEther('1'));
                receipt = await tx.wait();
              });
  
              it('emitted a DelegationUpdated event', async () => {
                const event = findEvent({
                  receipt,
                  eventName: 'DelegationUpdated',
                });
  
                assert.equal(event.args.liquidityItemId, liquidityItemId);
                assertBn.equal(event.args.fundId, 1);
                assertBn.equal(event.args.accountId, 1);
                assertBn.equal(event.args.amount, 0);
                assertBn.equal(event.args.leverage, ethers.utils.parseEther('1'));
                assert.equal(event.args.collateralType, Collateral.address);
              });
            });
          });
        });
      });
    });*/
  });
});
