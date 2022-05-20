const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('CollateralModule Stake', function () {
  const { proxyAddress } = bootstrap(initializer);

  let CollateralModule;
  let Collateral, CollateralPriceFeed;
  let AccountModule, AccountToken, accountTokenAddress;

  let owner, user1, user2, user3, user4;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
    [, user1, user2, user3, user4] = await ethers.getSigners();
  });

  before('identify contracts', async () => {
    CollateralModule = await ethers.getContractAt('CollateralModule', proxyAddress());
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();
    accountTokenAddress = await AccountModule.getAccountAddress();

    AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);
  });

  before('add one collateral', async () => {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    Collateral = await factory.deploy();

    await (await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('CollateralPriceFeedMock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(owner).setCurrentPrice(1)).wait();

    await (
      await CollateralModule.connect(owner).adjustCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200,
        false
      )
    ).wait();
  });

  before('mint some account tokens', async () => {
    await (await AccountModule.connect(user1).createAccount(1)).wait();
    await (await AccountModule.connect(user2).createAccount(2)).wait();
  });

  before('mint some collateral to the user', async () => {
    await (await Collateral.mint(user1.address, 1000)).wait();
    await (await Collateral.mint(user2.address, 1000)).wait();
  });

  before('approve AccountModule to operate with the user collateral', async () => {
    await (
      await Collateral.connect(user1).approve(AccountModule.address, ethers.constants.MaxUint256)
    ).wait();
    await (
      await Collateral.connect(user2).approve(AccountModule.address, ethers.constants.MaxUint256)
    ).wait();
  });

  it('is well configured', async () => {
    assert.equal((await CollateralModule.getCollateralTypes(false))[0], Collateral.address);

    const collateralType = await CollateralModule.getCollateralType(Collateral.address);

    assert.equal(collateralType[0], CollateralPriceFeed.address);
    assertBn.equal(collateralType[1], 400);
    assertBn.equal(collateralType[2], 200);
    assert.equal(collateralType[3], false);
  });

  describe('when some collateral is staked', () => {
    let receipt;
    describe('sanity check', async () => {
      it('AccountTokens has the right balance', async () => {
        assertBn.equal(await Collateral.balanceOf(user1.address), 1000);
        assertBn.equal(await Collateral.balanceOf(user2.address), 1000);
        assertBn.equal(await Collateral.balanceOf(CollateralModule.address), 0);
      });
    });

    describe('when attempting to stake more than available collateral', () => {
      it('reverts', async () => {
        await assertRevert(
          CollateralModule.connect(user1).stake(1, Collateral.address, 10000),
          'InsufficientBalance'
        );
      });
    });

    describe('stake', () => {
      before('stake some collateral', async () => {
        const tx = await CollateralModule.connect(user1).stake(1, Collateral.address, 100);
        receipt = await tx.wait();
      });

      it('emits an event', async () => {
        const event = findEvent({ receipt, eventName: 'CollateralStaked' });

        assertBn.equal(event.args.accountId, 1);
        assert.equal(event.args.collateralType, Collateral.address);
        assertBn.equal(event.args.amount, 100);
        assert.equal(event.args.executedBy, user1.address);
      });

      it('is staked', async () => {
        const totals = await CollateralModule.getAccountCollateralTotals(1, Collateral.address);
        const free = await CollateralModule.getAccountUnstakebleCollateral(1, Collateral.address);
        const unassigned = await CollateralModule.getAccountUnassignedCollateral(
          1,
          Collateral.address
        );

        assertBn.equal(totals[0], 100);
        assertBn.equal(totals[1], 0);
        assertBn.equal(totals[2], 0);
        assertBn.equal(free, 100);
        assertBn.equal(unassigned, 100);

        // In Collateral balances
        assertBn.equal(await Collateral.balanceOf(user1.address), 900);
        assertBn.equal(await Collateral.balanceOf(CollateralModule.address), 100);
      });
    });

    describe('when some collateral is unstaked', () => {
      describe('when attempting to stake more than available collateral', () => {
        it('reverts', async () => {
          await assertRevert(
            CollateralModule.connect(user1).unstake(1, Collateral.address, 101),
            'InsufficientAvailableCollateral'
          );
        });
      });

      describe('unstake', () => {
        before('unstake some collateral', async () => {
          const tx = await CollateralModule.connect(user1).unstake(1, Collateral.address, 100);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          const event = findEvent({ receipt, eventName: 'CollateralUnstaked' });

          assertBn.equal(event.args.accountId, 1);
          assert.equal(event.args.collateralType, Collateral.address);
          assertBn.equal(event.args.amount, 100);
          assert.equal(event.args.executedBy, user1.address);
        });

        it('is unstaked', async () => {
          const totals = await CollateralModule.getAccountCollateralTotals(1, Collateral.address);
          const free = await CollateralModule.getAccountUnstakebleCollateral(1, Collateral.address);
          const unassigned = await CollateralModule.getAccountUnassignedCollateral(
            1,
            Collateral.address
          );

          assertBn.equal(totals[0], 0);
          assertBn.equal(totals[1], 0);
          assertBn.equal(totals[2], 0);
          assertBn.equal(free, 0);
          assertBn.equal(unassigned, 0);

          // In Collateral balances
          assertBn.equal(await Collateral.balanceOf(user1.address), 1000);
          assertBn.equal(await Collateral.balanceOf(AccountToken.address), 0);
        });
      });
    });

    describe('post sanity check', async () => {
      it('AccountTokens has the right balance', async () => {
        assertBn.equal(await Collateral.balanceOf(user1.address), 1000);
        assertBn.equal(await Collateral.balanceOf(user2.address), 1000);
        assertBn.equal(await Collateral.balanceOf(AccountToken.address), 0);
      });
    });
  });

  describe('when an unauthorized address tries to operate in the AccountToken', () => {
    it('reverts when trying to stake', async () => {
      await assertRevert(
        CollateralModule.connect(user2).stake(1, Collateral.address, 100),
        `NotAuthorized(1, "0x7374616b65000000000000000000000000000000000000000000000000000000", "${user2.address}")`
      );
    });

    it('reverts when trying to unstake', async () => {
      await assertRevert(
        CollateralModule.connect(user2).unstake(1, Collateral.address, 100),
        `NotAuthorized(1, "0x756e7374616b6500000000000000000000000000000000000000000000000000", "${user2.address}")`
      );
    });

    it('reverts when trying to grant access', async () => {
      await assertRevert(
        AccountModule.connect(user2).grantRole(
          1,
          ethers.utils.formatBytes32String('stake'),
          user2.address
        ),
        `NotAuthorized(1, "${ethers.utils.formatBytes32String('modifyPermission')}", "${
          user2.address
        }")`
      );
    });
  });

  describe('when an authorized address operates with the AccountToken', () => {
    before('authorize some users', async () => {
      await (
        await AccountModule.connect(user1).grantRole(
          1,
          ethers.utils.formatBytes32String('stake'),
          user2.address
        )
      ).wait();
      await (
        await AccountModule.connect(user1).grantRole(
          1,
          ethers.utils.formatBytes32String('unstake'),
          user3.address
        )
      ).wait();
    });

    it('roles are granted', async () => {
      assert.equal(
        await AccountModule.hasRole(1, ethers.utils.formatBytes32String('stake'), user2.address),
        true
      );
      assert.equal(
        await AccountModule.hasRole(1, ethers.utils.formatBytes32String('unstake'), user3.address),
        true
      );
      assert.equal(
        await AccountModule.hasRole(1, ethers.utils.formatBytes32String('other'), user4.address),
        false
      );
    });

    describe('when some collateral is staked', () => {
      before('stake some collateral', async () => {
        await (await CollateralModule.connect(user2).stake(1, Collateral.address, 100)).wait();
      });

      it('is staked', async () => {
        const totals = await CollateralModule.getAccountCollateralTotals(1, Collateral.address);
        const free = await CollateralModule.getAccountUnstakebleCollateral(1, Collateral.address);
        const unassigned = await CollateralModule.getAccountUnassignedCollateral(
          1,
          Collateral.address
        );

        assertBn.equal(totals[0], 100);
        assertBn.equal(totals[1], 0);
        assertBn.equal(totals[2], 0);
        assertBn.equal(free, 100);
        assertBn.equal(unassigned, 100);

        // In Collateral balances
        assertBn.equal(await Collateral.balanceOf(user1.address), 900);
        assertBn.equal(await Collateral.balanceOf(CollateralModule.address), 100);
      });

      describe('when some collateral is unstaked', () => {
        before('unstake some collateral', async () => {
          await (await CollateralModule.connect(user3).unstake(1, Collateral.address, 100)).wait();
        });

        it('is unstaked', async () => {
          const totals = await CollateralModule.getAccountCollateralTotals(1, Collateral.address);
          const free = await CollateralModule.getAccountUnstakebleCollateral(1, Collateral.address);
          const unassigned = await CollateralModule.getAccountUnassignedCollateral(
            1,
            Collateral.address
          );

          assertBn.equal(totals[0], 0);
          assertBn.equal(totals[1], 0);
          assertBn.equal(totals[2], 0);
          assertBn.equal(free, 0);
          assertBn.equal(unassigned, 0);

          // In Collateral balances
          assertBn.equal(await Collateral.balanceOf(user1.address), 1000);
          assertBn.equal(await Collateral.balanceOf(CollateralModule.address), 0);
        });
      });
    });
  });
});
