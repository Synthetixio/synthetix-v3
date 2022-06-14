const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('CollateralModule SCCP', function () {
  const { proxyAddress } = bootstrap(initializer);

  let CollateralModule;
  let Collateral, CollateralPriceFeed;

  let systemOwner, user1;

  before('identify signers', async () => {
    [systemOwner] = await ethers.getSigners();
    [, user1] = await ethers.getSigners();
  });

  before('identify contract', async () => {
    CollateralModule = await ethers.getContractAt('CollateralModule', proxyAddress());
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
      await CollateralModule.connect(systemOwner).adjustCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200,
        false
      )
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

  describe('When the systemOwner adds another collaterals', () => {
    let AnotherCollateral, AnotherCollateralPriceFeed;
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

      const tx = await CollateralModule.connect(systemOwner).adjustCollateralType(
        AnotherCollateral.address,
        AnotherCollateralPriceFeed.address,
        400,
        200,
        false
      );
      await tx.wait();
    });

    it('is added', async () => {
      const collaterals = await CollateralModule.getCollateralTypes(false);
      assert.equal(collaterals[1], AnotherCollateral.address);
    });

    it('has the right configuration', async () => {
      const collateralType = await CollateralModule.getCollateralType(AnotherCollateral.address);
      assert.equal(collateralType[0], AnotherCollateralPriceFeed.address);
      assertBn.equal(collateralType[1], 400);
      assertBn.equal(collateralType[2], 200);
      assert.equal(collateralType[3], false);
    });

    describe('When the systemOwner updates the new collateral data', () => {
      before('updates the collateral', async () => {
        const tx = await CollateralModule.connect(systemOwner).adjustCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          300,
          250,
          false
        );
        await tx.wait();
      });

      it('is updated', async () => {
        const collateralType = await CollateralModule.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType[0], AnotherCollateralPriceFeed.address);
        assertBn.equal(collateralType[1], 300);
        assertBn.equal(collateralType[2], 250);
        assert.equal(collateralType[3], false);
      });
    });

    describe('When the systemOwner disables the new collateral', () => {
      before('disables the collateral', async () => {
        const tx = await CollateralModule.connect(systemOwner).adjustCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          400,
          200,
          false
        );
        await tx.wait();
      });

      it('is not shown in enabled list', async () => {
        const allCollaterals = await CollateralModule.getCollateralTypes(false);
        const enabledCollaterals = await CollateralModule.getCollateralTypes(true);

        assert.equal(allCollaterals.includes(AnotherCollateral.address), true);
        assert.equal(enabledCollaterals.includes(AnotherCollateral.address), false);
      });

      it('is disabled', async () => {
        const collateralType = await CollateralModule.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType[3], false);
      });
    });
  });

  describe('When another user attempts to interact with collaterals', () => {
    let OtherCollateral, OtherCollateralPriceFeed;
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
        CollateralModule.connect(user1).adjustCollateralType(
          OtherCollateral.address,
          OtherCollateralPriceFeed.address,
          400,
          200,
          false
        ),
        `Unauthorized("${user1.address}")`
      );
    });

    it('reverts when attempting to update', async () => {
      await assertRevert(
        CollateralModule.connect(user1).adjustCollateralType(
          Collateral.address,
          CollateralPriceFeed.address,
          300,
          250,
          false
        ),
        `Unauthorized("${user1.address}")`
      );
    });
  });
});
