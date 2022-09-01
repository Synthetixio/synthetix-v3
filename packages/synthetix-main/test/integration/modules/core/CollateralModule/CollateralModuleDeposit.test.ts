import { ethers } from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../../../bootstrap';
import { ethers as Ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';

describe.only('CollateralModule Deposit', function () {
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

    await (await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('AggregatorV3Mock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(owner).mockSetCurrentPrice(1)).wait();

    await (
      await systems()
        .Core.connect(owner)
        .configureCollateralType(Collateral.address, CollateralPriceFeed.address, 400, 200, 0, true)
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

  before('approve systems().Core to operate with the user collateral', async () => {
    await (
      await Collateral.connect(user1).approve(systems().Core.address, ethers.constants.MaxUint256)
    ).wait();
    await (
      await Collateral.connect(user2).approve(systems().Core.address, ethers.constants.MaxUint256)
    ).wait();
  });

  it('is well configured', async () => {
    assert.equal(
      (await systems().Core.getCollateralTypes(false))[0].tokenAddress,
      Collateral.address
    );

    const collateralType = await systems().Core.getCollateralType(Collateral.address);

    assert.equal(collateralType.priceFeed, CollateralPriceFeed.address);
    assertBn.equal(collateralType.targetCRatio, 400);
    assertBn.equal(collateralType.minimumCRatio, 200);
    assert.equal(collateralType.enabled, true);
  });

  describe('when some collateral is deposited', () => {
    let receipt: Ethers.providers.TransactionReceipt;
    describe('sanity check', async () => {
      it('systems().Accounts has the right balance', async () => {
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
        assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), 1000);
        assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
      });
    });

    describe('when attempting to deposit more than available collateral', () => {
      it('reverts', async () => {
        await assertRevert(
          systems().Core.connect(user1).depositCollateral(1, Collateral.address, 10000),
          'FailedTransfer',
          systems().Core
        );
      });
    });

    describe('deposit', () => {
      before('deposit some collateral', async () => {
        const tx = await systems()
          .Core.connect(user1)
          .depositCollateral(1, Collateral.address, 100);
        receipt = await tx.wait();
      });

      it('emits an event', async () => {
        assertEvent(
          receipt,
          `CollateralDeposited("1", "${Collateral.address}", "100", "${await user1.getAddress()}")`,
          systems().Core
        );
      });

      it('is deposited', async () => {
        const totals = await systems().Core.getAccountCollateral(1, Collateral.address);
        const free = await systems().Core.getAccountAvailableCollateral(1, Collateral.address);
        const unassigned = await systems().Core.getAccountAvailableCollateral(
          1,
          Collateral.address
        );

        assertBn.equal(totals[0], 100);
        assertBn.equal(totals[1], 0);
        assertBn.equal(free, 100);
        assertBn.equal(unassigned, 100);

        // In Collateral balances
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 900);
        assertBn.equal(await Collateral.balanceOf(systems().Core.address), 100);
      });
    });

    describe('when some collateral is withdrawn', () => {
      describe('when attempting to deposit more than available collateral', () => {
        it('reverts', async () => {
          await assertRevert(
            systems().Core.connect(user1).withdrawCollateral(1, Collateral.address, 101),
            'InsufficientAccountCollateral',
            systems().Core
          );
        });
      });

      describe('withdraw', () => {
        before('withdraw some collateral', async () => {
          const tx = await systems()
            .Core.connect(user1)
            .withdrawCollateral(1, Collateral.address, 100);
          receipt = await tx.wait();
        });

        it('emits an event', async () => {
          assertEvent(
            receipt,
            `CollateralWithdrawn("1", "${Collateral.address}", "100", "${await user1.getAddress}")`,
            systems().Core
          );
        });

        it('is withdrawn', async () => {
          const totals = await systems().Core.getAccountCollateral(1, Collateral.address);
          const free = await systems().Core.getAccountAvailableCollateral(1, Collateral.address);
          const unassigned = await systems().Core.getAccountAvailableCollateral(
            1,
            Collateral.address
          );

          assertBn.equal(totals[0], 0);
          assertBn.equal(totals[1], 0);
          assertBn.equal(free, 0);
          assertBn.equal(unassigned, 0);

          // In Collateral balances
          assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
          assertBn.equal(await Collateral.balanceOf(systems().Account.address), 0);
        });
      });
    });

    describe('post sanity check', async () => {
      it('systems().Accounts has the right balance', async () => {
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
        assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), 1000);
        assertBn.equal(await Collateral.balanceOf(systems().Account.address), 0);
      });
    });
  });

  describe('when an unauthorized address tries to operate in the systems().Account', () => {
    it('reverts when trying to withdraw', async () => {
      await assertRevert(
        systems().Core.connect(user2).depositCollateral(1, Collateral.address, 100),
        `PermissionDenied("1", "0x4445504f53495400000000000000000000000000000000000000000000000000", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts when trying to withdrawCollateral', async () => {
      await assertRevert(
        systems().Core.connect(user2).withdrawCollateral(1, Collateral.address, 100),
        `PermissionDenied("1", "0x5749544844524157000000000000000000000000000000000000000000000000", "${await user2.getAddress()}")`,
        systems().Core
      );
    });

    it('reverts when trying to grant access', async () => {
      await assertRevert(
        systems()
          .Core.connect(user2)
          .grantPermission(
            1,
            ethers.utils.formatBytes32String('DEPOSIT'),
            await user2.getAddress()
          ),
        `PermissionDenied("1", "0x41444d494e000000000000000000000000000000000000000000000000000000", "${await user2.getAddress()}")`,
        systems().Core
      );
    });
  });

  describe('when an authorized address operates with the systems().Account', () => {
    before('authorize some users', async () => {
      await (
        await systems()
          .Core.connect(user1)
          .grantPermission(1, ethers.utils.formatBytes32String('DEPOSIT'), await user2.getAddress())
      ).wait();
      await (
        await systems()
          .Core.connect(user1)
          .grantPermission(
            1,
            ethers.utils.formatBytes32String('WITHDRAW'),
            await user3.getAddress()
          )
      ).wait();
    });

    it('roles are granted', async () => {
      assert.equal(
        await systems().Core.hasPermission(
          1,
          ethers.utils.formatBytes32String('DEPOSIT'),
          await user2.getAddress()
        ),
        true
      );
      assert.equal(
        await systems().Core.hasPermission(
          1,
          ethers.utils.formatBytes32String('WITHDRAW'),
          await user3.getAddress()
        ),
        true
      );
      assert.equal(
        await systems().Core.hasPermission(
          1,
          ethers.utils.formatBytes32String('OTHER'),
          await user4.getAddress()
        ),
        false
      );
    });

    describe('when some collateral is deposited', () => {
      before('deposit some collateral', async () => {
        await (
          await systems().Core.connect(user2).depositCollateral(1, Collateral.address, 100)
        ).wait();
      });

      it('is deposited', async () => {
        const totals = await systems().Core.getAccountCollateral(1, Collateral.address);
        const free = await systems().Core.getAccountAvailableCollateral(1, Collateral.address);
        const unassigned = await systems().Core.getAccountAvailableCollateral(
          1,
          Collateral.address
        );

        assertBn.equal(totals[0], 100);
        assertBn.equal(totals[1], 0);
        assertBn.equal(free, 100);
        assertBn.equal(unassigned, 100);

        // In Collateral balances
        assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 900);
        assertBn.equal(await Collateral.balanceOf(systems().Core.address), 100);
      });

      describe('when some collateral is withdrawn', () => {
        before('withdraw some collateral', async () => {
          await (
            await systems().Core.connect(user3).withdrawCollateral(1, Collateral.address, 100)
          ).wait();
        });

        it('is withdrawn', async () => {
          const totals = await systems().Core.getAccountCollateral(1, Collateral.address);
          const free = await systems().Core.getAccountAvailableCollateral(1, Collateral.address);
          const unassigned = await systems().Core.getAccountAvailableCollateral(
            1,
            Collateral.address
          );

          assertBn.equal(totals[0], 0);
          assertBn.equal(totals[1], 0);
          assertBn.equal(free, 0);
          assertBn.equal(unassigned, 0);

          // In Collateral balances
          assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
          assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
        });
      });
    });
  });
});
