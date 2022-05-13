const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('AccountToken', function () {
  const { proxyAddress } = bootstrap(initializer);

  let AccountModule, AccountTokenAddress, AccountToken;
  let Collateral, CollateralPriceFeed;

  let systemOwner, user1, user2, user3, user4, user5;

  before('identify signers', async () => {
    [systemOwner] = await ethers.getSigners();
    [, user1, user2, user3, user4, user5] = await ethers.getSigners();
  });

  before('create and identify AccountToken contract', async () => {
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());

    await (await AccountModule.connect(systemOwner).initializeAccountModule()).wait();
    assert.equal(await AccountModule.isAccountModuleInitialized(), true);

    AccountTokenAddress = await AccountModule.getAccountAddress();
    AccountToken = await ethers.getContractAt('AccountToken', AccountTokenAddress);
    assert.equal(await AccountToken.isAccountInitialized(), true);
  });

  before('add one collateral', async () => {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    Collateral = await factory.deploy();

    await (await Collateral.connect(systemOwner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('CollateralPriceFeedMock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(systemOwner).setCurrentPrice(1)).wait();

    await (
      await AccountModule.connect(systemOwner).addCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200
      )
    ).wait();
  });

  it('is well configured', async () => {
    assert.equal((await AccountToken.getCollateralTypes())[0], Collateral.address);

    const collateralType = await AccountToken.getCollateralType(Collateral.address);

    assert.equal(collateralType[0], CollateralPriceFeed.address);
    assertBn.equal(collateralType[1], 400);
    assertBn.equal(collateralType[2], 200);
    assert.equal(collateralType[3], false);
  });

  describe('When operating with the callateral', () => {
    before('mint some collateral to the AccountTokens', async () => {
      await (await Collateral.mint(user1.address, 1000)).wait();
      await (await Collateral.mint(user2.address, 1000)).wait();
    });

    before('approve AccountToken to operate with the user collateral', async () => {
      await (
        await Collateral.connect(user1).approve(AccountToken.address, ethers.constants.MaxUint256)
      ).wait();
      await (
        await Collateral.connect(user2).approve(AccountToken.address, ethers.constants.MaxUint256)
      ).wait();
    });

    describe('when an AccountToken is minted', () => {
      let receipt;

      before('mint the AccountToken', async () => {
        const tx = await AccountToken.connect(user1).mint(user1.address, 1);
        receipt = await tx.wait();
      });

      it('emits an event', async () => {
        const event = findEvent({ receipt, eventName: 'AccountTokenMinted' });
        assert.equal(event.args.owner, user1.address);
        assertBn.equal(event.args.AccountTokenId, 1);
      });

      it('is minted', async () => {
        assert.equal(await AccountToken.ownerOf(1), user1.address);
      });

      describe('when trying to mint the same AccountTokenId', () => {
        it('reverts', async () => {
          await assertRevert(
            AccountToken.connect(user2).mint(user2.address, 1),
            'TokenAlreadyMinted(1)'
          );
        });
      });

      describe('when some collateral is staked', () => {
        describe('sanity check', async () => {
          it('AccountTokens has the right balance', async () => {
            assertBn.equal(await Collateral.balanceOf(user1.address), 1000);
            assertBn.equal(await Collateral.balanceOf(user2.address), 1000);
            assertBn.equal(await Collateral.balanceOf(AccountToken.address), 0);
          });
        });

        describe('when attempting to stake more than available collateral', () => {
          it('reverts', async () => {
            await assertRevert(
              AccountToken.connect(user1).stake(1, Collateral.address, 10000),
              'InsufficientBalance'
            );
          });
        });

        describe('stake', () => {
          before('stake some collateral', async () => {
            const tx = await AccountToken.connect(user1).stake(1, Collateral.address, 100);
            receipt = await tx.wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'CollateralStaked' });

            assertBn.equal(event.args.AccountTokenId, 1);
            assert.equal(event.args.collateralType, Collateral.address);
            assertBn.equal(event.args.amount, 100);
            assert.equal(event.args.executedBy, user1.address);
          });

          it('is staked', async () => {
            const totals = await AccountToken.getCollateralTotals(1, Collateral.address);
            const free = await AccountToken.getFreeCollateral(1, Collateral.address);
            const unassigned = await AccountToken.getUnassignedCollateral(1, Collateral.address);

            assertBn.equal(totals[0], 100);
            assertBn.equal(totals[1], 0);
            assertBn.equal(totals[2], 0);
            assertBn.equal(free, 100);
            assertBn.equal(unassigned, 100);

            // In Collateral balances
            assertBn.equal(await Collateral.balanceOf(user1.address), 900);
            assertBn.equal(await Collateral.balanceOf(AccountToken.address), 100);
          });
        });

        describe('when some collateral is unstaked', () => {
          describe('when attempting to stake more than available collateral', () => {
            it('reverts', async () => {
              await assertRevert(
                AccountToken.connect(user1).unstake(1, Collateral.address, 101),
                'InsufficientAvailableCollateral'
              );
            });
          });

          describe('unstake', () => {
            before('unstake some collateral', async () => {
              const tx = await AccountToken.connect(user1).unstake(1, Collateral.address, 100);
              receipt = await tx.wait();
            });

            it('emits an event', async () => {
              const event = findEvent({ receipt, eventName: 'CollateralUnstaked' });

              assertBn.equal(event.args.AccountTokenId, 1);
              assert.equal(event.args.collateralType, Collateral.address);
              assertBn.equal(event.args.amount, 100);
              assert.equal(event.args.executedBy, user1.address);
            });

            it('is unstaked', async () => {
              const totals = await AccountToken.getCollateralTotals(1, Collateral.address);
              const free = await AccountToken.getFreeCollateral(1, Collateral.address);
              const unassigned = await AccountToken.getUnassignedCollateral(1, Collateral.address);

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
            AccountToken.connect(user2).stake(1, Collateral.address, 100),
            `NotAuthorized(1, "0x7374616b65000000000000000000000000000000000000000000000000000000", "${user2.address}")`
          );
        });

        it('reverts when trying to unstake', async () => {
          await assertRevert(
            AccountToken.connect(user2).unstake(1, Collateral.address, 100),
            `NotAuthorized(1, "0x756e7374616b6500000000000000000000000000000000000000000000000000", "${user2.address}")`
          );
        });

        it('reverts when trying to grant access', async () => {
          await assertRevert(
            AccountToken.connect(user2).grantRole(
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
            await AccountToken.connect(user1).grantRole(
              1,
              ethers.utils.formatBytes32String('stake'),
              user2.address
            )
          ).wait();
          await (
            await AccountToken.connect(user1).grantRole(
              1,
              ethers.utils.formatBytes32String('unstake'),
              user3.address
            )
          ).wait();
          await (
            await AccountToken.connect(user1).grantRole(
              1,
              ethers.utils.formatBytes32String('owner'),
              user4.address
            )
          ).wait();
        });

        it('roles are granted', async () => {
          assert.equal(
            await AccountToken.hasRole(1, ethers.utils.formatBytes32String('stake'), user2.address),
            true
          );
          assert.equal(
            await AccountToken.hasRole(
              1,
              ethers.utils.formatBytes32String('unstake'),
              user3.address
            ),
            true
          );
          assert.equal(
            await AccountToken.hasRole(1, ethers.utils.formatBytes32String('owner'), user4.address),
            true
          );
          assert.equal(
            await AccountToken.hasRole(1, ethers.utils.formatBytes32String('other'), user5.address),
            false
          );
        });

        describe('when granting a role', () => {
          before('grant an user a role', async () => {
            const tx = await await AccountToken.connect(user1).grantRole(
              1,
              ethers.utils.formatBytes32String('other'),
              user5.address
            );
            receipt = await tx.wait();
          });

          it('emit an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleGranted' });

            assertBn.equal(event.args.AccountTokenId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('other'));
            assert.equal(event.args.target, user5.address);
            assert.equal(event.args.executedBy, user1.address);
          });

          it('role is granted', async () => {
            assert.equal(
              await AccountToken.hasRole(
                1,
                ethers.utils.formatBytes32String('other'),
                user5.address
              ),
              true
            );
          });
        });

        describe('when some collateral is staked', () => {
          before('stake some collateral', async () => {
            const tx = await AccountToken.connect(user2).stake(1, Collateral.address, 100);
            receipt = await tx.wait();
          });

          it('emits an event', async () => {
            const event = findEvent({ receipt, eventName: 'CollateralStaked' });

            assertBn.equal(event.args.AccountTokenId, 1);
            assert.equal(event.args.collateralType, Collateral.address);
            assertBn.equal(event.args.amount, 100);
            assert.equal(event.args.executedBy, user2.address);
          });

          it('is staked', async () => {
            const totals = await AccountToken.getCollateralTotals(1, Collateral.address);
            const free = await AccountToken.getFreeCollateral(1, Collateral.address);
            const unassigned = await AccountToken.getUnassignedCollateral(1, Collateral.address);

            assertBn.equal(totals[0], 100);
            assertBn.equal(totals[1], 0);
            assertBn.equal(totals[2], 0);
            assertBn.equal(free, 100);
            assertBn.equal(unassigned, 100);

            // In Collateral balances
            assertBn.equal(await Collateral.balanceOf(user1.address), 900);
            assertBn.equal(await Collateral.balanceOf(AccountToken.address), 100);
          });

          describe('when some collateral is unstaked', () => {
            before('unstake some collateral', async () => {
              const tx = await AccountToken.connect(user3).unstake(1, Collateral.address, 100);
              receipt = await tx.wait();
            });

            it('emits an event', async () => {
              const event = findEvent({ receipt, eventName: 'CollateralUnstaked' });

              assertBn.equal(event.args.AccountTokenId, 1);
              assert.equal(event.args.collateralType, Collateral.address);
              assertBn.equal(event.args.amount, 100);
              assert.equal(event.args.executedBy, user3.address);
            });

            it('is unstaked', async () => {
              const totals = await AccountToken.getCollateralTotals(1, Collateral.address);
              const free = await AccountToken.getFreeCollateral(1, Collateral.address);
              const unassigned = await AccountToken.getUnassignedCollateral(1, Collateral.address);

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

        describe('when an admin tries to grant more access', () => {
          before('grant another user a role', async () => {
            const tx = await await AccountToken.connect(user4).grantRole(
              1,
              ethers.utils.formatBytes32String('another'),
              user5.address
            );
            receipt = await tx.wait();
          });

          it('emit an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleGranted' });

            assertBn.equal(event.args.AccountTokenId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('another'));
            assert.equal(event.args.target, user5.address);
            assert.equal(event.args.executedBy, user4.address);
          });

          it('role is granted', async () => {
            assert.equal(
              await AccountToken.hasRole(
                1,
                ethers.utils.formatBytes32String('another'),
                user5.address
              ),
              true
            );
          });

          describe('when an admin tries to revoke more access', () => {
            before('revoke another user a role', async () => {
              const tx = await await AccountToken.connect(user4).revokeRole(
                1,
                ethers.utils.formatBytes32String('another'),
                user5.address
              );
              receipt = await tx.wait();
            });

            it('emit an event', async () => {
              const event = findEvent({ receipt, eventName: 'RoleRevoked' });

              assertBn.equal(event.args.AccountTokenId, 1);
              assert.equal(event.args.role, ethers.utils.formatBytes32String('another'));
              assert.equal(event.args.target, user5.address);
              assert.equal(event.args.executedBy, user4.address);
            });

            it('role is granted', async () => {
              assert.equal(
                await AccountToken.hasRole(
                  1,
                  ethers.utils.formatBytes32String('another'),
                  user5.address
                ),
                false
              );
            });
          });
        });

        describe('when someone renounce a role', () => {
          before('revoke another user a role', async () => {
            const tx = await await AccountToken.connect(user5).renounceRole(
              1,
              ethers.utils.formatBytes32String('other'),
              user5.address
            );
            receipt = await tx.wait();
          });

          it('emit an event', async () => {
            const event = findEvent({ receipt, eventName: 'RoleRevoked' });

            assertBn.equal(event.args.AccountTokenId, 1);
            assert.equal(event.args.role, ethers.utils.formatBytes32String('other'));
            assert.equal(event.args.target, user5.address);
            assert.equal(event.args.executedBy, user5.address);
          });

          it('role is granted', async () => {
            assert.equal(
              await AccountToken.hasRole(
                1,
                ethers.utils.formatBytes32String('user5'),
                user5.address
              ),
              false
            );
          });
        });
      });
    });
  });

  describe('When the systemOwner adds another collaterals', () => {
    let AnotherCollateral, AnotherCollateralPriceFeed;
    before('add another collateral', async () => {
      let factory;

      factory = await ethers.getContractFactory('CollateralMock');
      AnotherCollateral = await factory.deploy();
      await (
        await AnotherCollateral.connect(systemOwner).initialize('Another Token', 'ANT', 18)
      ).wait();

      factory = await ethers.getContractFactory('CollateralPriceFeedMock');
      AnotherCollateralPriceFeed = await factory.deploy();

      await (await AnotherCollateralPriceFeed.connect(systemOwner).setCurrentPrice(100)).wait();

      const tx = await AccountModule.connect(systemOwner).addCollateralType(
        AnotherCollateral.address,
        AnotherCollateralPriceFeed.address,
        400,
        200
      );
      await tx.wait();
    });

    it('is added', async () => {
      const collaterals = await AccountToken.getCollateralTypes();
      assert.equal(collaterals[1], AnotherCollateral.address);
    });

    it('has the right configuration', async () => {
      const collateralType = await AccountToken.getCollateralType(AnotherCollateral.address);
      assert.equal(collateralType[0], AnotherCollateralPriceFeed.address);
      assertBn.equal(collateralType[1], 400);
      assertBn.equal(collateralType[2], 200);
      assert.equal(collateralType[3], false);
    });

    describe('When the systemOwner updates the new collateral data', () => {
      before('updates the collateral', async () => {
        const tx = await AccountModule.connect(systemOwner).adjustCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          300,
          250,
          false
        );
        await tx.wait();
      });

      it('is updated', async () => {
        const collateralType = await AccountToken.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType[0], AnotherCollateralPriceFeed.address);
        assertBn.equal(collateralType[1], 300);
        assertBn.equal(collateralType[2], 250);
        assert.equal(collateralType[3], false);
      });
    });

    describe('When the systemOwner disables the new collateral', () => {
      before('disables the collateral', async () => {
        const tx = await AccountModule.connect(systemOwner).adjustCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          400,
          200,
          true
        );
        await tx.wait();
      });

      it('is disabled', async () => {
        const collateralType = await AccountToken.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType[3], true);
      });
    });
  });
});
