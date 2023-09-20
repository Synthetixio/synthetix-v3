import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers, Contract, Signer } from 'ethers';
import { addCollateral, verifyCollateral } from './CollateralModule.helper';
import Permissions from '../../../mixins/AccountRBACMixin.permissions';
import { bn, bootstrap } from '../../../bootstrap';

describe('CollateralModule', function () {
  const { signers, systems } = bootstrap();

  let Collateral: Contract, oracleNodeId: string;

  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let user3: Signer;

  describe('CollateralModule - Access control', function () {
    before('identify signers', async () => {
      [owner, user1, user2, user3] = signers();
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

          describe('when an unauthorized account tries to withdraw collateral', function () {
            it('reverts', async () => {
              await assertRevert(
                systems().Core.connect(user2).withdraw(1, Collateral.address, 100),
                `PermissionDenied("1", "${Permissions.WITHDRAW}", "${await user2.getAddress()}")`,
                systems().Core
              );
            });
          });

          describe('when an account authorizes other users to operate', function () {
            before('grant WITHDRAW permissions', async () => {
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

            describe('when the authorized account deposits collateral', function () {
              const depositAmount = ethers.utils.parseUnits('1', 6);
              const systemDepositAmount = ethers.utils.parseEther('1');

              before('deposit some collateral', async () => {
                await (
                  await systems().Core.connect(user2).deposit(1, Collateral.address, depositAmount)
                ).wait();
              });

              it('shows that tokens have moved', async function () {
                assertBn.equal(
                  await Collateral.balanceOf(await user2.getAddress()),
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

              describe('when the authorized account withdraws collateral', function () {
                before('withdraw some collateral', async () => {
                  await (
                    await systems()
                      .Core.connect(user3)
                      .withdraw(1, Collateral.address, depositAmount)
                  ).wait();
                });

                it('shows that tokens have moved', async function () {
                  assertBn.equal(await Collateral.balanceOf(await user1.getAddress()), mintAmount);
                  assertBn.equal(await Collateral.balanceOf(systems().Core.address), 0);
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

                  assertBn.equal(totalStaked, 0);
                  assertBn.equal(totalAssigned, 0);
                  assertBn.equal(totalAvailable, 0);
                });
              });
            });
          });
        });
      });
    });
  });
});
