import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { fastForwardTo, getTime } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { snapshotCheckpoint } from '@synthetixio/core-utils/utils/mocha/snapshot';
import { ethers as Ethers } from 'ethers';
import { ethers } from 'hardhat';
import { bn, bootstrap } from '../../../bootstrap';
import { verifyUsesFeatureFlag } from '../../../verifications';
import { addCollateral, verifyCollateral } from './CollateralModule.helper';

describe('CollateralModule', function () {
  const { signers, systems, provider } = bootstrap();

  let Collateral: Ethers.Contract, oracleNodeId: string;

  let owner: Ethers.Signer, user1: Ethers.Signer, user2: Ethers.Signer;

  let receipt: Ethers.providers.TransactionReceipt;

  describe('CollateralModule - Depositing and withdrawing collateral', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    before('create some accounts', async () => {
      await (await systems().Core.connect(user1)['createAccount(uint128)'](1)).wait();
      await (await systems().Core.connect(user2)['createAccount(uint128)'](2)).wait();
    });

    describe('when a collateral is added', function () {
      before('add collateral type', async () => {
        ({ Collateral, oracleNodeId } = await addCollateral(
          'Synthetix Token',
          'SNX',
          bn(4),
          bn(2),
          owner,
          systems().Core,
          systems().OracleManager
        ));
      });

      it('is well configured', async () => {
        await verifyCollateral(1, Collateral, oracleNodeId, bn(4), bn(2), true, systems().Core);
      });

      describe('when accounts have tokens', function () {
        const mintAmount = ethers.utils.parseUnits('1000', 6);

        before('mint some tokens', async () => {
          await (await Collateral.mint(await user1.getAddress(), mintAmount)).wait();
          await (await Collateral.mint(await user2.getAddress(), mintAmount)).wait();
        });

        it('shows correct balances', async () => {
          assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), mintAmount);
          assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), mintAmount);
          assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
        });

        describe('when accounts provide allowance', function () {
          const depositAmount = ethers.utils.parseUnits('1', 6);
          const systemDepositAmount = ethers.utils.parseEther('1');
          before('approve', async () => {
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
          });

          describe('when attempting to deposit more tokens than the user has', () => {
            it('reverts', async () => {
              const amount = mintAmount.add(1);

              await assertRevert(
                systems().Core.connect(user1).deposit(1, Collateral.address, amount),
                `FailedTransfer("${await user1.getAddress()}", "${
                  systems().Core.address
                }", "${amount}")`,
                systems().Core
              );
            });
          });

          verifyUsesFeatureFlag(
            () => systems().Core,
            'deposit',
            () => systems().Core.connect(user1).deposit(1, Collateral.address, 1)
          );

          it('fails when depositing to nonexistant account', async () => {
            await assertRevert(
              systems().Core.connect(user1).deposit(283729, Collateral.address, depositAmount),
              'AccountNotFound("283729")',
              systems().Core
            );
          });

          describe('when depositing collateral', () => {
            before('deposit some collateral', async () => {
              const tx = await systems()
                .Core.connect(user1)
                .deposit(1, Collateral.address, depositAmount);
              receipt = await tx.wait();
            });

            it('emits an event', async () => {
              await assertEvent(
                receipt,
                `Deposited(1, "${
                  Collateral.address
                }", ${depositAmount.toString()}, "${await user1.getAddress()}")`,
                systems().Core
              );
            });

            it('shows that tokens have moved', async function () {
              assertBn.equal(
                await Collateral.balanceOf(await user1.getAddress()),
                mintAmount.sub(depositAmount)
              );
              assertBn.equal(await Collateral.balanceOf(systems().Core.address), depositAmount);
            });

            it('shows that the collateral has been registered', async function () {
              const [totalStaked, totalAssigned] = await systems().Core.getAccountCollateral(
                1,
                Collateral.address
              );
              const totalAvailable = await systems().Core.getAccountAvailableCollateral(
                1,
                Collateral.address
              );

              assertBn.equal(totalStaked, systemDepositAmount);
              assertBn.equal(totalAssigned, 0);
              assertBn.equal(totalAvailable, systemDepositAmount);
            });

            describe('when attempting to withdraw more than available collateral', () => {
              it('reverts', async () => {
                const amount = depositAmount.add('1');

                // Collateral uses 6 decimals and system operates with 18,
                // so scale up the expected amount.
                const errorAmount = amount.mul(ethers.BigNumber.from(10).pow(12));

                await assertRevert(
                  systems().Core.connect(user1).withdraw(1, Collateral.address, amount),
                  `InsufficientAccountCollateral("${errorAmount}")`,
                  systems().Core
                );
              });
            });

            verifyUsesFeatureFlag(
              () => systems().Core,
              'withdraw',
              () => systems().Core.connect(user1).withdraw(1, Collateral.address, depositAmount)
            );

            describe('when there is a account withdraw timeout set', async () => {
              const restore = snapshotCheckpoint(provider);

              const expireTime = 180;
              before('set timeout', async () => {
                // make sure the account has an interaction
                await systems()
                  .Core.connect(owner)
                  .Account_set_lastInteraction(1, getTime(provider()));

                await systems()
                  .Core.connect(owner)
                  .setConfig(
                    ethers.utils.formatBytes32String('accountTimeoutWithdraw'),
                    ethers.utils.zeroPad(ethers.BigNumber.from(expireTime).toHexString(), 32)
                  );
              });

              after(restore);

              it('should not allow withdrawal because of account interaction', async () => {
                console.log('last interaction', await systems().Core.getAccountLastInteraction(1));
                await assertRevert(
                  systems().Core.connect(user1).withdraw(1, Collateral.address, depositAmount),
                  'AccountActivityTimeoutPending',
                  systems().Core
                );
              });

              describe('time passes', () => {
                before('fast forward', async () => {
                  await fastForwardTo(
                    (await systems().Core.getAccountLastInteraction(1)).toNumber() + expireTime,
                    provider()
                  );
                });

                it('works', async () => {
                  await systems()
                    .Core.connect(user1)
                    .withdraw(1, Collateral.address, depositAmount);
                });
              });
            });

            describe('when withdrawing collateral', () => {
              before('withdraw some collateral', async () => {
                const tx = await systems()
                  .Core.connect(user1)
                  .withdraw(1, Collateral.address, depositAmount);
                receipt = await tx.wait();
              });

              it('emits an event', async () => {
                await assertEvent(
                  receipt,
                  `Withdrawn(1, "${
                    Collateral.address
                  }", ${depositAmount.toString()}, "${await user1.getAddress()}")`,
                  systems().Core
                );
              });

              it('shows that the tokens have moved', async function () {
                assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), mintAmount);
                assertBn.equal(await Collateral.balanceOf(systems().Account.address), 0);
              });

              it('shows that the registered collateral has been updated accordingly', async function () {
                const [totalStaked, totalAssigned] = await systems().Core.getAccountCollateral(
                  1,
                  Collateral.address
                );
                const totalAvailable = await systems().Core.getAccountAvailableCollateral(
                  1,
                  Collateral.address
                );

                assertBn.equal(totalStaked, 0);
                assertBn.equal(totalAssigned, 0);
                assertBn.equal(totalAvailable, 0);
              });
            });

            describe('when locking collateral', () => {
              const secondsInMonth = 60 * 60 * 24 * 30;
              let lockedUntil: number;

              before('deposit and lock some collateral', async () => {
                const tx = await systems()
                  .Core.connect(user2)
                  .deposit(2, Collateral.address, depositAmount);
                receipt = await tx.wait();

                // establish time when collateral is expected to be unlocked
                const currentTime = await getTime(provider());
                lockedUntil = currentTime + secondsInMonth;

                // lock collateral until specified time
                await systems()
                  .Core.connect(user2)
                  .createLock(2, Collateral.address, depositAmount, lockedUntil);
              });

              it('reverts when attempting to withdraw locked collateral', async () => {
                // Collateral uses 6 decimals and system operates with 18,
                // so scale up the expected amount.
                const errorAmount = depositAmount.mul(ethers.BigNumber.from(10).pow(12));

                // expect revert during attempt to withdraw locked collateral before specified time
                await assertRevert(
                  systems().Core.connect(user2).withdraw(2, Collateral.address, depositAmount),
                  `InsufficientAccountCollateral("${errorAmount}")`,
                  systems().Core
                );
              });

              describe('when withdrawing unlocked collateral', () => {
                before('fastforward and withdraw unlocked collateral', async () => {
                  await fastForwardTo(lockedUntil, provider());
                  const tx = await systems()
                    .Core.connect(user2)
                    .withdraw(2, Collateral.address, depositAmount);
                  receipt = await tx.wait();
                });

                it('shows unlocked collateral can be withdrawn', async () => {
                  // expect involved account balances are correct
                  assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), mintAmount);
                });

                it('shows that the registered collateral has been updated accordingly', async function () {
                  const [totalStaked, totalAssigned] = await systems().Core.getAccountCollateral(
                    2,
                    Collateral.address
                  );
                  const totalAvailable = await systems().Core.getAccountAvailableCollateral(
                    2,
                    Collateral.address
                  );

                  assertBn.equal(totalStaked, 0);
                  assertBn.equal(totalAssigned, 0);
                  assertBn.equal(totalAvailable, 0);
                });
              });
            });

            describe('after deposits and withdrawals occurred', async () => {
              it('all balances are correct', async () => {
                assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), mintAmount);
                assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), mintAmount);
                assertBn.equal(await Collateral.balanceOf(systems().Account.address), 0);
              });
            });
          });
        });
      });
    });
  });
});
