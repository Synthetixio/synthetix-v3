import { ethers } from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/dist/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-js/dist/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/dist/utils/ethers/events';
import { bootstrap } from '../bootstrap';
import { ethers as Ethers } from 'ethers';

describe('CollateralModule Stake', function () {
  const { signers, systems } = bootstrap();

  let Collateral: Ethers.Contract, CollateralPriceFeed: Ethers.Contract;

  let owner: Ethers.Signer,
    user1: Ethers.Signer,
    user2: Ethers.Signer,
    user3: Ethers.Signer,
    user4: Ethers.Signer;

  before('identify signers', async () => {
    [owner, user1, user2, user3, user4] = signers();
  });

  before('add one collateral', async () => {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    Collateral = await factory.connect(owner).deploy();

    await (
      await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)
    ).wait();

    factory = await ethers.getContractFactory('AggregatorV3Mock');
    CollateralPriceFeed = await factory.deploy();

    await (
      await CollateralPriceFeed.connect(owner).mockSetCurrentPrice(1)
    ).wait();

    await (
      await systems()
        .Core.connect(owner)
        .adjustCollateralType(
          Collateral.address,
          CollateralPriceFeed.address,
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

  it('is well configured', async () => {
    assert.equal(
      (await systems().Core.getCollateralTypes(false))[0].tokenAddress,
      Collateral.address
    );

    const collateralType = await systems().Core.getCollateralType(
      Collateral.address
    );

    assert.equal(collateralType.priceFeed, CollateralPriceFeed.address);
    assertBn.equal(collateralType.targetCRatio, 400);
    assertBn.equal(collateralType.minimumCRatio, 200);
    assert.equal(collateralType.enabled, true);
  });

  describe('when some collateral is staked', () => {
    let receipt: Ethers.providers.TransactionReceipt;
    describe('sanity check', async () => {
      it('systems().Accounts has the right balance', async () => {
        assertBn.equal(
          await Collateral.balanceOf(await user1.getAddress()),
          1000
        );
        assertBn.equal(
          await Collateral.balanceOf(await user2.getAddress()),
          1000
        );
        assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
      });
    });

    describe('when attempting to stake more than available collateral', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(user1).stake(1, Collateral.address, 10000),
          'InsufficientBalance',
          Collateral
        );
      });
    });

    describe('stake', () => {
      before('stake some collateral', async () => {
        const tx = await systems()
          .Core.connect(user1)
          .stake(1, Collateral.address, 100);
        receipt = await tx.wait();
      });

      it('emits an event', async () => {
        const event = findEvent({ receipt, eventName: 'CollateralStaked' });

        assertBn.equal(event.args.accountId, 1);
        assert.equal(event.args.collateralType, Collateral.address);
        assertBn.equal(event.args.amount, 100);
        assert.equal(event.args.executedBy, await user1.getAddress());
      });

      it('is staked', async () => {
        const totals = await systems().Core.getAccountCollateralTotals(
          1,
          Collateral.address
        );
        const free = await systems().Core.getAccountUnstakebleCollateral(
          1,
          Collateral.address
        );
        const unassigned = await systems().Core.getAccountUnassignedCollateral(
          1,
          Collateral.address
        );

        assertBn.equal(totals[0], 100);
        assertBn.equal(totals[1], 0);
        assertBn.equal(totals[2], 0);
        assertBn.equal(free, 100);
        assertBn.equal(unassigned, 100);

        // In Collateral balances
        assertBn.equal(
          await Collateral.balanceOf(await user1.getAddress()),
          900
        );
        assertBn.equal(await Collateral.balanceOf(systems().Core.address), 100);
      });
    });

    describe('when some collateral is unstaked', () => {
      describe('when attempting to stake more than available collateral', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user1).unstake(1, Collateral.address, 101),
            'InsufficientAvailableCollateral',
            systems().Core
          );
        });
      });

      describe('unstake', () => {
        before('unstake some collateral', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .unstake(1, Collateral.address, 100);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'CollateralUnstaked' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.collateralType, Collateral.address);
          assertBn.equal(event.args.amount, 100);
          assert.equal(event.args.executedBy, await user1.getAddress());
        });

        it('is unstaked', async () => {
          const totals = await systems().Core.getAccountCollateralTotals(
            1,
            Collateral.address
          );
          const free = await systems().Core.getAccountUnstakebleCollateral(
            1,
            Collateral.address
          );
          const unassigned =
            await systems().Core.getAccountUnassignedCollateral(
              1,
              Collateral.address
            );

          assertBn.equal(totals[0], 0);
          assertBn.equal(totals[1], 0);
          assertBn.equal(totals[2], 0);
          assertBn.equal(free, 0);
          assertBn.equal(unassigned, 0);

          // In Collateral balances
          assertBn.equal(
            await Collateral.balanceOf(await user1.getAddress()),
            1000
          );
          assertBn.equal(
            await Collateral.balanceOf(systems().Account.address),
            0
          );
        });
      });
    });

    describe('post sanity check', async () => {
      it('systems().Accounts has the right balance', async () => {
        assertBn.equal(
          await Collateral.balanceOf(await user1.getAddress()),
          1000
        );
        assertBn.equal(
          await Collateral.balanceOf(await user2.getAddress()),
          1000
        );
        assertBn.equal(
          await Collateral.balanceOf(systems().Account.address),
          0
        );
      });
    });
  });

  describe('when an unauthorized address tries to operate in the systems().Account', () => {
    it('reverts when trying to stake', async () => {
      await assertRevert(
        systems().Core.connect(user2).stake(1, Collateral.address, 100),
        `NotAuthorized("1", "0x7374616b65000000000000000000000000000000000000000000000000000000", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts when trying to unstake', async () => {
      await assertRevert(
        systems().Core.connect(user2).unstake(1, Collateral.address, 100),
        `NotAuthorized("1", "0x756e7374616b6500000000000000000000000000000000000000000000000000", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts when trying to grant access', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .grantRole(
            1,
            ethers.utils.formatBytes32String('stake'),
            await user2.getAddress()
          ),
        `NotAuthorized("1", "${ethers.utils.formatBytes32String(
          'modifyPermission'
        )}", "${await user2.getAddress()}")`,
        systems().Core
      );
    });
  });

  describe('when an authorized address operates with the systems().Account', () => {
    before('authorize some users', async () => {
      await (
        await systems()
          .Core.connect(user1)
          .grantRole(
            1,
            ethers.utils.formatBytes32String('stake'),
            await user2.getAddress()
          )
      ).wait();
      await (
        await systems()
          .Core.connect(user1)
          .grantRole(
            1,
            ethers.utils.formatBytes32String('unstake'),
            await user3.getAddress()
          )
      ).wait();
    });

    it('roles are granted', async () => {
      assert.equal(
        await systems().Core.hasRole(
          1,
          ethers.utils.formatBytes32String('stake'),
          await user2.getAddress()
        ),
        true
      );
      assert.equal(
        await systems().Core.hasRole(
          1,
          ethers.utils.formatBytes32String('unstake'),
          await user3.getAddress()
        ),
        true
      );
      assert.equal(
        await systems().Core.hasRole(
          1,
          ethers.utils.formatBytes32String('other'),
          await user4.getAddress()
        ),
        false
      );
    });

    describe('when some collateral is staked', () => {
      before('stake some collateral', async () => {
        await (
          await systems().Core.connect(user2).stake(1, Collateral.address, 100)
        ).wait();
      });

      it('is staked', async () => {
        const totals = await systems().Core.getAccountCollateralTotals(
          1,
          Collateral.address
        );
        const free = await systems().Core.getAccountUnstakebleCollateral(
          1,
          Collateral.address
        );
        const unassigned = await systems().Core.getAccountUnassignedCollateral(
          1,
          Collateral.address
        );

        assertBn.equal(totals[0], 100);
        assertBn.equal(totals[1], 0);
        assertBn.equal(totals[2], 0);
        assertBn.equal(free, 100);
        assertBn.equal(unassigned, 100);

        // In Collateral balances
        assertBn.equal(
          await Collateral.balanceOf(await user1.getAddress()),
          900
        );
        assertBn.equal(await Collateral.balanceOf(systems().Core.address), 100);
      });

      describe('when some collateral is unstaked', () => {
        before('unstake some collateral', async () => {
          await (
            await systems()
              .Core.connect(user3)
              .unstake(1, Collateral.address, 100)
          ).wait();
        });

        it('is unstaked', async () => {
          const totals = await systems().Core.getAccountCollateralTotals(
            1,
            Collateral.address
          );
          const free = await systems().Core.getAccountUnstakebleCollateral(
            1,
            Collateral.address
          );
          const unassigned =
            await systems().Core.getAccountUnassignedCollateral(
              1,
              Collateral.address
            );

          assertBn.equal(totals[0], 0);
          assertBn.equal(totals[1], 0);
          assertBn.equal(totals[2], 0);
          assertBn.equal(free, 0);
          assertBn.equal(unassigned, 0);

          // In Collateral balances
          assertBn.equal(
            await Collateral.balanceOf(await user1.getAddress()),
            1000
          );
          assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
        });
      });
    });
  });
});
