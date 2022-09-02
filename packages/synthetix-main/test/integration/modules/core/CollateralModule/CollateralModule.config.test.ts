import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers as Ethers } from 'ethers';
import { ethers } from 'hardhat';
import { bootstrap } from '../../../bootstrap';

describe('CollateralModule', function () {
  const { signers, systems } = bootstrap();

  let systemOwner: Ethers.Signer, user1: Ethers.Signer;

  let Collateral: Ethers.Contract, CollateralPriceFeed: Ethers.Contract;
  let AnotherCollateral: Ethers.Contract, AnotherCollateralPriceFeed: Ethers.Contract;

  async function addCollateral(
    tokenName: string,
    tokenSymbol: string,
    targetCRatio: number,
    minimumCRatio: number,
  ) {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    const Collateral = await factory.connect(systemOwner).deploy();

    await (await Collateral.connect(systemOwner).initialize(tokenName, tokenSymbol, 18)).wait();

    factory = await ethers.getContractFactory('AggregatorV3Mock');
    const CollateralPriceFeed = await factory.connect(systemOwner).deploy();

    await (await CollateralPriceFeed.connect(systemOwner).mockSetCurrentPrice(1)).wait();

    await (
      await systems()
        .Core.connect(systemOwner)
        .configureCollateralType(
          Collateral.address,
          CollateralPriceFeed.address,
          targetCRatio,
          minimumCRatio,
          0,
          true
        )
    ).wait();

    return { Collateral, CollateralPriceFeed };
  }

  async function verifyCollateral(
    collateralIdx: number,
    Collateral: Ethers.Contract,
    CollateralPriceFeed: Ethers.Contract,
    expectedCRatio: number,
    expectedMinimumCRatio: number,
    expectedToBeEnabled: boolean,
  ) {
    assert.equal(
      (await systems().Core.getCollateralTypes(false))[collateralIdx].tokenAddress,
      Collateral.address
    );

    const collateralType = await systems().Core.getCollateralType(Collateral.address);

    assert.equal(collateralType.tokenAddress, Collateral.address);
    assert.equal(collateralType.priceFeed, CollateralPriceFeed.address);
    assertBn.equal(collateralType.targetCRatio, expectedCRatio);
    assertBn.equal(collateralType.minimumCRatio, expectedMinimumCRatio);
    assert.equal(collateralType.enabled, expectedToBeEnabled);
  }

  async function verifyCollateralListed(Collateral: Ethers.Contract, listed: boolean, hideDisabled: boolean) {
    const collaterals = await systems().Core.getCollateralTypes(hideDisabled);

    assert.equal(
      collaterals.some((v: any) => v.tokenAddress === Collateral.address),
      listed
    );
  }

  describe('CollateralModule - Collateral configuration', function () {
    before('identify signers', async () => {
      [systemOwner, user1] = signers();
    });

    describe('when a regular user attempts to add a collateral', function () {
      it('reverts', async () => {
        const dummyAddress = await user1.getAddress();

        await assertRevert(
          systems()
            .Core.connect(user1)
            .configureCollateralType(
              dummyAddress,
              dummyAddress,
              400,
              200,
              0,
              false
            ),
          `Unauthorized("${await user1.getAddress()}")`,
          systems().Core
        );
      });
    });

    describe('when the first collateral is added', function () {
      before('add collateral', async () => {
        ({ Collateral, CollateralPriceFeed } = await addCollateral('Synthetix Token', 'SNX', 400, 200));
      });

      it('is well configured', async () => {
        await verifyCollateral(0, Collateral, CollateralPriceFeed, 400, 200, true);
      });

      it('shows in the collateral list', async function () {
        await verifyCollateralListed(Collateral, true, true);
      });

      describe('when a second collateral is added', () => {
        before('add collateral', async () => {
          ({ Collateral: AnotherCollateral, CollateralPriceFeed: AnotherCollateralPriceFeed } = await addCollateral('Another Token', 'ANT', 400, 200));
        });

        it('is well configured', async () => {
          await verifyCollateral(1, AnotherCollateral, AnotherCollateralPriceFeed, 400, 200, true);
        });

        it('shows in the collateral list', async function () {
          await verifyCollateralListed(AnotherCollateral, true, true);
        });

        describe('when a regular user attempts to update the second collateral', function () {
          it('reverts', async () => {
            await assertRevert(
              systems()
                .Core.connect(user1)
                .configureCollateralType(
                  AnotherCollateral.address,
                  AnotherCollateralPriceFeed.address,
                  200,
                  100,
                  0,
                  true
                ),
              `Unauthorized("${await user1.getAddress()}")`,
              systems().Core
            );
          });
        });

        describe('when the second collateral is updated', () => {
          before('update the collateral', async () => {
            const tx = await systems()
              .Core.connect(systemOwner)
              .configureCollateralType(
                AnotherCollateral.address,
                AnotherCollateralPriceFeed.address,
                300,
                250,
                0,
                true
              );
            await tx.wait();
          });

          it('is well configured', async () => {
            await verifyCollateral(1, AnotherCollateral, AnotherCollateralPriceFeed, 300, 250, true);
          });

          it('shows in the collateral list', async function () {
            await verifyCollateralListed(AnotherCollateral, true, true);
          });
        });

        describe('when the second collateral is disabled', () => {
          before('disable the collateral', async () => {
            const tx = await systems()
              .Core.connect(systemOwner)
              .configureCollateralType(
                AnotherCollateral.address,
                AnotherCollateralPriceFeed.address,
                300,
                250,
                0,
                false
              );
            await tx.wait();
          });

          it('is well configured', async () => {
            await verifyCollateral(1, AnotherCollateral, AnotherCollateralPriceFeed, 300, 250, false);
          });

          it('shows in the collateral list', async function () {
            await verifyCollateralListed(AnotherCollateral, true, false);
            await verifyCollateralListed(AnotherCollateral, false, true);
          });
        });
      });
    });
  });
});
