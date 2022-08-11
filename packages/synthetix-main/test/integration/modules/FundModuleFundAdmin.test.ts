import hre from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/utils/ethers/events';
import { bootstrap } from '../bootstrap';

import { ethers } from 'ethers';

describe('FundModule Admin', function () {
  const { signers, systems } = bootstrap();

  let owner: ethers.Signer,
    fundAdmin: ethers.Signer,
    user1: ethers.Signer,
    user2: ethers.Signer;

  let Collateral: ethers.Contract, AggregatorV3Mock: ethers.Contract;

  before('identify signers', async () => {
    [owner, fundAdmin, user1, user2] = signers();
  });

  before('add one collateral', async () => {
    let factory;

    factory = await hre.ethers.getContractFactory('CollateralMock');
    Collateral = await factory.connect(owner).deploy();

    await (
      await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)
    ).wait();

    factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
    AggregatorV3Mock = await factory.connect(owner).deploy();

    await (await AggregatorV3Mock.connect(owner).mockSetCurrentPrice(1)).wait();

    await (
      await systems()
        .Core.connect(owner)
        .adjustCollateralType(
          Collateral.address,
          AggregatorV3Mock.address,
          400,
          200,
          true
        )
    ).wait();
  });

  before('mint some account tokens', async () => {
    await (await systems().Core.connect(user1).createAccount(1)).wait();
    await (await systems().Core.connect(user2).createAccount(2)).wait();
  });

  before('mint some collateral to the user', async () => {
    await (await Collateral.mint(await user1.getAddress(), 1000)).wait();
    await (await Collateral.mint(await user2.getAddress(), 1000)).wait();
  });

  before(
    'approve systems().Core to operate with the user collateral',
    async () => {
      await (
        await Collateral.connect(user1).approve(
          systems().Core.address,
          ethers.constants.MaxUint256
        )
      ).wait();
      await (
        await Collateral.connect(user2).approve(
          systems().Core.address,
          ethers.constants.MaxUint256
        )
      ).wait();
    }
  );

  before('stake some collateral', async () => {
    await (
      await systems().Core.connect(user1).stake(1, Collateral.address, 100)
    ).wait();
  });

  before('mint a fund token', async () => {
    await (
      await systems()
        .Core.connect(user1)
        .createFund(1, await fundAdmin.getAddress())
    ).wait();
  });

  it('fund is created', async () => {
    assert.equal(await systems().Core.ownerOf(1), await fundAdmin.getAddress());
  });

  describe('When setting up the Fund positions', async () => {
    describe('when attempting to set the positions of a non existent fund', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems()
            .Core.connect(fundAdmin)
            .setFundPosition(2, [1], [1], [0, 0]),
          'FundNotFound("2")',
          systems().Core
        );
      });
    });

    describe('when a regular user attempts to set the positions', async () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(user1).setFundPosition(1, [1], [1], [0, 0]),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when attempting to set the positions with not matching number of positions', async () => {
      it('reverts with more weights than markets', async () => {
        await assertRevert(
          systems()
            .Core.connect(fundAdmin)
            .setFundPosition(1, [1], [1, 2], [0, 0]),
          'InvalidParameters()',
          systems().Core
        );
      });

      it('reverts with more markets than weights', async () => {
        await assertRevert(
          systems()
            .Core.connect(fundAdmin)
            .setFundPosition(1, [1, 2], [1], [0, 0]),
          'InvalidParameters()',
          systems().Core
        );
      });
    });

    describe('when adjusting a fund positions', async () => {
      let receipt: ethers.providers.TransactionReceipt;

      before('set dummy markets', async () => {
        const factory = await hre.ethers.getContractFactory('MarketMock');
        const Market1 = await factory.connect(owner).deploy();
        const Market2 = await factory.connect(owner).deploy();

        await (
          await systems().Core.connect(owner).registerMarket(Market1.address)
        ).wait();
        await (
          await systems().Core.connect(owner).registerMarket(Market2.address)
        ).wait();
      });

      before('adjust fund positions', async () => {
        const tx = await systems()
          .Core.connect(fundAdmin)
          .setFundPosition(1, [1, 2], [1, 1], [0, 0]);
        receipt = await tx.wait();
      });

      it('emmited an event', async () => {
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
              .Core.connect(user1)
              .delegateCollateral(1, 1, Collateral.address, 10, 1);
            receipt = await tx.wait();
          });

          it('emmited a DelegationUpdated event', async () => {
            const event = findEvent({
              receipt,
              eventName: 'DelegationUpdated',
            });
            liquidityItemId = event.args.liquidityItemId;

            assertBn.equal(event.args.fundId, 1);
            assertBn.equal(event.args.accountId, 1);
            assertBn.equal(event.args.amount, 10);
            assertBn.equal(event.args.leverage, 1);
            assert.equal(event.args.collateralType, Collateral.address);
          });

          it('emmited a PositionAdded event', async () => {
            const event = findEvent({ receipt, eventName: 'PositionAdded' });

            assert.equal(event.args.liquidityItemId, liquidityItemId);
            assertBn.equal(event.args.fundId, 1);
            assertBn.equal(event.args.accountId, 1);
            assertBn.equal(event.args.amount, 10);
            assertBn.equal(event.args.leverage, 1);
            assert.equal(event.args.collateralType, Collateral.address);
            assertBn.equal(event.args.shares, 10);
            assertBn.equal(event.args.initialDebt, 10);
          });

          describe('when adding to the same liquidityId', async () => {
            before('delegate some collateral', async () => {
              const tx = await systems()
                .Core.connect(user1)
                .delegateCollateral(1, 1, Collateral.address, 20, 1);
              receipt = await tx.wait();
            });

            it('emmited a DelegationUpdated event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'DelegationUpdated',
              });

              assert.equal(event.args.liquidityItemId, liquidityItemId);
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.accountId, 1);
              assertBn.equal(event.args.amount, 20);
              assertBn.equal(event.args.leverage, 1);
              assert.equal(event.args.collateralType, Collateral.address);
            });

            it('emmited a PositionIncreased event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'PositionIncreased',
              });

              assert.equal(event.args.liquidityItemId, liquidityItemId);
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.amount, 20);
              assertBn.equal(event.args.leverage, 1);
              assert.equal(event.args.collateralType, Collateral.address);
              assertBn.equal(event.args.shares, 20);
              assertBn.equal(event.args.initialDebt, 20);
            });
          });

          describe('when decreasing from to same liquidityId', async () => {
            before('delegate some collateral', async () => {
              const tx = await systems()
                .Core.connect(user1)
                .delegateCollateral(1, 1, Collateral.address, 1, 1);
              receipt = await tx.wait();
            });

            it('emmited a DelegationUpdated event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'DelegationUpdated',
              });

              assert.equal(event.args.liquidityItemId, liquidityItemId);
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.accountId, 1);
              assertBn.equal(event.args.amount, 1);
              assertBn.equal(event.args.leverage, 1);
              assert.equal(event.args.collateralType, Collateral.address);
            });

            it('emmited a PositionDecreased event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'PositionDecreased',
              });

              assert.equal(event.args.liquidityItemId, liquidityItemId);
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.amount, 1);
              assertBn.equal(event.args.leverage, 1);
              assert.equal(event.args.collateralType, Collateral.address);
              assertBn.equal(event.args.shares, 1);
              assertBn.equal(event.args.initialDebt, 1);
            });
          });

          describe('when removing liquidityId', async () => {
            before('delegate some collateral', async () => {
              const tx = await systems()
                .Core.connect(user1)
                .delegateCollateral(1, 1, Collateral.address, 0, 1);
              receipt = await tx.wait();
            });

            it('emmited a DelegationUpdated event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'DelegationUpdated',
              });

              assert.equal(event.args.liquidityItemId, liquidityItemId);
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.accountId, 1);
              assertBn.equal(event.args.amount, 0);
              assertBn.equal(event.args.leverage, 1);
              assert.equal(event.args.collateralType, Collateral.address);
            });

            it('emmited a PositionRemoved event', async () => {
              const event = findEvent({
                receipt,
                eventName: 'PositionRemoved',
              });

              assert.equal(event.args.liquidityItemId, liquidityItemId);
              assertBn.equal(event.args.fundId, 1);
              assertBn.equal(event.args.accountId, 1);
              assert.equal(event.args.collateralType, Collateral.address);
            });
          });
        });
      });
    });
  });
});
