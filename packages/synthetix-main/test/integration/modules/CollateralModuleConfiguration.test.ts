import { ethers } from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import { bootstrap } from '../bootstrap';
import { ethers as Ethers } from 'ethers';

describe('systems().Core Configuration (SCCP)', function () {
  const { signers, systems } = bootstrap();

  let systemOwner: Ethers.Signer, user1: Ethers.Signer;

  let Collateral: Ethers.Contract;
  let CollateralPriceFeed: Ethers.Contract;

  before('identify signers', async () => {
    [systemOwner, user1] = signers();
  });

  before('add one collateral', async () => {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    Collateral = await factory.deploy();

    await (await Collateral.connect(systemOwner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('AggregatorV3Mock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(systemOwner).mockSetCurrentPrice(1)).wait();

    await (
      await systems().Core.connect(systemOwner).adjustCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200,
        false
      )
    ).wait();
  });

  it('is well configured', async () => {
    assert.equal(
      (await systems().Core.getCollateralTypes(false))[0].tokenAddress,
      Collateral.address
    );

    const collateralType = await systems().Core.getCollateralType(Collateral.address);
    console.log(collateralType);

    assert.equal(collateralType.tokenAddress, Collateral.address);
    assert.equal(collateralType.priceFeed, CollateralPriceFeed.address);
    assertBn.equal(collateralType.targetCRatio, 400);
    assertBn.equal(collateralType.minimumCRatio, 200);
    assert.equal(collateralType.enabled, false);
  });

  describe('When the systemOwner adds another collaterals', () => {
    let AnotherCollateral: Ethers.Contract, AnotherCollateralPriceFeed: Ethers.Contract;
    before('add another collateral', async () => {
      let factory;

      factory = await ethers.getContractFactory('CollateralMock');
      AnotherCollateral = await factory.deploy();
      await (
        await AnotherCollateral.connect(systemOwner).initialize('Another Token', 'ANT', 18)
      ).wait();

      factory = await ethers.getContractFactory('AggregatorV3Mock');
      AnotherCollateralPriceFeed = await factory.deploy();

      await (await AnotherCollateralPriceFeed.connect(systemOwner).mockSetCurrentPrice(100)).wait();

      const tx = await systems().Core.connect(systemOwner).adjustCollateralType(
        AnotherCollateral.address,
        AnotherCollateralPriceFeed.address,
        400,
        200,
        false
      );
      await tx.wait();
    });

    it('is added', async () => {
      const collaterals = await systems().Core.getCollateralTypes(false);
      assert.equal(collaterals[1].tokenAddress, AnotherCollateral.address);
    });

    it('has the right configuration', async () => {
      const collateralType = await systems().Core.getCollateralType(AnotherCollateral.address);
      assert.equal(collateralType.priceFeed, AnotherCollateralPriceFeed.address);
      assertBn.equal(collateralType.targetCRatio, 400);
      assertBn.equal(collateralType.minimumCRatio, 200);
      assert.equal(collateralType.enabled, false);
    });

    describe('When the systemOwner updates the new collateral data', () => {
      before('updates the collateral', async () => {
        const tx = await systems().Core.connect(systemOwner).adjustCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          300,
          250,
          false
        );
        await tx.wait();
      });

      it('is updated', async () => {
        const collateralType = await systems().Core.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType.priceFeed, AnotherCollateralPriceFeed.address);
        assertBn.equal(collateralType.targetCRatio, 300);
        assertBn.equal(collateralType.minimumCRatio, 250);
        assert.equal(collateralType.enabled, false);
      });
    });

    describe('When the systemOwner disables the new collateral', () => {
      before('disables the collateral', async () => {
        const tx = await systems().Core.connect(systemOwner).adjustCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          400,
          200,
          false
        );
        await tx.wait();
      });

      it('is not shown in enabled list', async () => {
        const allCollaterals = await systems().Core.getCollateralTypes(false);
        const enabledCollaterals = await systems().Core.getCollateralTypes(true);

        assert.equal(
          allCollaterals.some((v: any) => v.tokenAddress === AnotherCollateral.address),
          true
        );
        assert.equal(
          enabledCollaterals.some((v: any) => v.tokenAddress === AnotherCollateral.address),
          false
        );
      });

      it('is disabled', async () => {
        const collateralType = await systems().Core.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType.enabled, false);
      });
    });
  });

  describe('When another user attempts to interact with collaterals', () => {
    let OtherCollateral: Ethers.Contract, OtherCollateralPriceFeed: Ethers.Contract;
    before('create the other collateral', async () => {
      let factory;

      factory = await ethers.getContractFactory('CollateralMock');
      OtherCollateral = await factory.deploy();
      await (
        await OtherCollateral.connect(systemOwner).initialize('Another Token', 'ANT', 18)
      ).wait();

      factory = await ethers.getContractFactory('AggregatorV3Mock');
      OtherCollateralPriceFeed = await factory.deploy();

      await (await OtherCollateralPriceFeed.connect(systemOwner).mockSetCurrentPrice(100)).wait();
    });

    it('reverts when attempting to add', async () => {
      await assertRevert(
        systems().Core.connect(user1).adjustCollateralType(
          OtherCollateral.address,
          OtherCollateralPriceFeed.address,
          400,
          200,
          false
        ),
        `Unauthorized("${await user1.getAddress()}")`
      );
    });

    it('reverts when attempting to update', async () => {
      await assertRevert(
        systems().Core.connect(user1).adjustCollateralType(
          Collateral.address,
          CollateralPriceFeed.address,
          300,
          250,
          false
        ),
        `Unauthorized("${await user1.getAddress()}")`
      );
    });
  });
});
