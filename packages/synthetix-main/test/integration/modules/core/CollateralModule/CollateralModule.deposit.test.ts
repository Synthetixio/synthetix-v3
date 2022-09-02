import { ethers } from 'hardhat';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../../../bootstrap';
import { ethers as Ethers } from 'ethers';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import { addCollateral, verifyCollateral } from './CollateralModule.helper';

describe.only('CollateralModule', function () {
  const { signers, systems } = bootstrap();

  let Collateral: Ethers.Contract, CollateralPriceFeed: Ethers.Contract;

  let owner: Ethers.Signer, user1: Ethers.Signer, user2: Ethers.Signer;

  let receipt: Ethers.providers.TransactionReceipt;

  describe('CollateralModule - Depositing and withdrawing collateral', function () {
    before('identify signers', async () => {
      [owner, user1, user2] = signers();
    });

    before('create some accounts', async () => {
      await (await systems().Core.connect(user1).createAccount(1)).wait();
      await (await systems().Core.connect(user2).createAccount(2)).wait();
    });

    describe('when a collateral is addded', function () {
      before('add collateral type', async () => {
        ({ Collateral, CollateralPriceFeed } = await addCollateral(
          'Synthetix Token',
          'SNX',
          400,
          200,
          owner,
          systems().Core
        ));
      });

      it('is well configured', async () => {
        await verifyCollateral(0, Collateral, CollateralPriceFeed, 400, 200, true, systems().Core);
      });

      describe('when accounts have tokens', function () {
        before('mint some tokens', async () => {
          await (await Collateral.mint(await user1.getAddress(), 1000)).wait();
          await (await Collateral.mint(await user2.getAddress(), 1000)).wait();
        });

        it('shows correct balances', async () => {
          assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
          assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), 1000);
          assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
        });

        describe('when accounts provide allowance', function () {
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
              await assertRevert(
                systems().Core.connect(user1).depositCollateral(1, Collateral.address, 10000),
                'FailedTransfer',
                systems().Core
              );
            });
          });

          describe('when depositing collateral', () => {
            before('deposit some collateral', async () => {
              const tx = await systems()
                .Core.connect(user1)
                .depositCollateral(1, Collateral.address, 100);
              receipt = await tx.wait();
            });

            it('emits an event', async () => {
              assertEvent(
                receipt,
                `CollateralDeposited("1", "${
                  Collateral.address
                }", "100", "${await user1.getAddress()}")`,
                systems().Core
              );
            });

            it('shows that tokens have moved', async function () {
              assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 900);
              assertBn.equal(await Collateral.balanceOf(systems().Core.address), 100);
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

              assertBn.equal(totalStaked, 100);
              assertBn.equal(totalAssigned, 0);
              assertBn.equal(totalAvailable, 100);
            });

            describe('when attempting to withdraw more than available collateral', () => {
              it('reverts', async () => {
                await assertRevert(
                  systems().Core.connect(user1).withdrawCollateral(1, Collateral.address, 101),
                  'InsufficientAccountCollateral',
                  systems().Core
                );
              });
            });

            describe('when withdrawing collateral', () => {
              before('withdraw some collateral', async () => {
                const tx = await systems()
                  .Core.connect(user1)
                  .withdrawCollateral(1, Collateral.address, 100);
                receipt = await tx.wait();
              });

              it('emits an event', async () => {
                assertEvent(
                  receipt,
                  `CollateralWithdrawn("1", "${
                    Collateral.address
                  }", "100", "${await user1.getAddress()}")`,
                  systems().Core
                );
              });

              it('shows that the tokens have moved', async function () {
                assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
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

            describe('after deposits and withdrawals occurred', async () => {
              it('all balances are correct', async () => {
                assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), 1000);
                assertBn.equal(await Collateral.balanceOf(await user2.getAddress()), 1000);
                assertBn.equal(await Collateral.balanceOf(systems().Account.address), 0);
              });
            });
          });
        });
      });
    });
  });
});
