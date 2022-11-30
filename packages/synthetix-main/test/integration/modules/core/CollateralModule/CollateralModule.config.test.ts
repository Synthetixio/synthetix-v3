import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers as Ethers } from 'ethers';
import { bootstrap } from '../../../bootstrap';
import { addCollateral, verifyCollateral, verifyCollateralListed } from './CollateralModule.helper';

describe('CollateralModule', function () {
  const { signers, systems } = bootstrap();

  let systemOwner: Ethers.Signer, user1: Ethers.Signer;

  let Collateral: Ethers.Contract, CollateralPriceFeed: Ethers.Contract;
  let AnotherCollateral: Ethers.Contract, AnotherCollateralPriceFeed: Ethers.Contract;

  describe('CollateralModule - Collateral configuration', function () {
    before('identify signers', async () => {
      [systemOwner, user1] = signers();
    });

    describe('when a regular user attempts to add a collateral', function () {
      it('reverts', async () => {
        const dummyAddress = await user1.getAddress();

        await assertRevert(
          systems().Core.connect(user1).configureCollateral({
            tokenAddress: dummyAddress,
            priceFeed: dummyAddress,
            issuanceRatioD18: 400,
            liquidationRatioD18: 200,
            liquidationReward: 0,
            minDelegation: 0,
            depositingEnabled: false,
          }),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when the first collateral is added', function () {
      before('add collateral', async () => {
        ({ Collateral, CollateralPriceFeed } = await addCollateral(
          'Synthetix Token',
          'SNX',
          400,
          200,
          systemOwner,
          systems().Core
        ));
      });

      it('is well configured', async () => {
        await verifyCollateral(0, Collateral, CollateralPriceFeed, 400, 200, true, systems().Core);
      });

      it('shows in the collateral list', async function () {
        await verifyCollateralListed(Collateral, true, true, systems().Core);
      });

      describe('when a second collateral is added', () => {
        before('add collateral', async () => {
          ({ Collateral: AnotherCollateral, CollateralPriceFeed: AnotherCollateralPriceFeed } =
            await addCollateral('Another Token', 'ANT', 400, 200, systemOwner, systems().Core));
        });

        it('is well configured', async () => {
          await verifyCollateral(
            1,
            AnotherCollateral,
            AnotherCollateralPriceFeed,
            400,
            200,
            true,
            systems().Core
          );
        });

        it('shows in the collateral list', async function () {
          await verifyCollateralListed(AnotherCollateral, true, true, systems().Core);
        });

        describe('when a regular user attempts to update the second collateral', function () {
          it('reverts', async () => {
            await assertRevert(
              systems().Core.connect(user1).configureCollateral({
                tokenAddress: AnotherCollateral.address,
                priceFeed: AnotherCollateralPriceFeed.address,
                issuanceRatioD18: 200,
                liquidationRatioD18: 100,
                liquidationReward: 0,
                minDelegation: 0,
                depositingEnabled: false,
              }),
              `Unauthorized("${await user1.getAddress()}")`,
              systems().Core
            );
          });
        });

        describe('when the second collateral is updated', () => {
          before('update the collateral', async () => {
            const tx = await systems().Core.connect(systemOwner).configureCollateral({
              tokenAddress: AnotherCollateral.address,
              priceFeed: AnotherCollateralPriceFeed.address,
              issuanceRatioD18: 300,
              liquidationRatioD18: 250,
              liquidationReward: 0,
              minDelegation: 0,
              depositingEnabled: true,
            });
            await tx.wait();
          });

          it('is well configured', async () => {
            await verifyCollateral(
              1,
              AnotherCollateral,
              AnotherCollateralPriceFeed,
              300,
              250,
              true,
              systems().Core
            );
          });

          it('shows in the collateral list', async function () {
            await verifyCollateralListed(AnotherCollateral, true, true, systems().Core);
          });
        });

        describe('when the second collateral is disabled', () => {
          before('disable the collateral', async () => {
            const tx = await systems().Core.connect(systemOwner).configureCollateral({
              tokenAddress: AnotherCollateral.address,
              priceFeed: AnotherCollateralPriceFeed.address,
              issuanceRatioD18: 300,
              liquidationRatioD18: 250,
              liquidationReward: 0,
              minDelegation: 0,
              depositingEnabled: false,
            });
            await tx.wait();
          });

          it('is well configured', async () => {
            await verifyCollateral(
              1,
              AnotherCollateral,
              AnotherCollateralPriceFeed,
              300,
              250,
              false,
              systems().Core
            );
          });

          it('shows in the collateral list', async function () {
            await verifyCollateralListed(AnotherCollateral, true, false, systems().Core);
            await verifyCollateralListed(AnotherCollateral, false, true, systems().Core);
          });
        });
      });
    });
  });
});
