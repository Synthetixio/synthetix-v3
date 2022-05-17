const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('CollateralModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let CollateralModule;
  let Collateral, CollateralPriceFeed;

  let systemOwner, user1, user2, user3, user4, user5;

  before('identify signers', async () => {
    [systemOwner] = await ethers.getSigners();
    [, user1, user2, user3, user4, user5] = await ethers.getSigners();
  });

  before('identify contract', async () => {
    CollateralModule = await ethers.getContractAt('CollateralModule', proxyAddress());
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
      await CollateralModule.connect(systemOwner).addCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200
      )
    ).wait();
  });

  it('is well configured', async () => {
    assert.equal((await CollateralModule.getCollateralTypes())[0], Collateral.address);

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

      factory = await ethers.getContractFactory('CollateralPriceFeedMock');
      AnotherCollateralPriceFeed = await factory.deploy();

      await (await AnotherCollateralPriceFeed.connect(systemOwner).setCurrentPrice(100)).wait();

      const tx = await CollateralModule.connect(systemOwner).addCollateralType(
        AnotherCollateral.address,
        AnotherCollateralPriceFeed.address,
        400,
        200
      );
      await tx.wait();
    });

    it('is added', async () => {
      const collaterals = await CollateralModule.getCollateralTypes();
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
          true
        );
        await tx.wait();
      });

      it('is disabled', async () => {
        const collateralType = await CollateralModule.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType[3], true);
      });
    });
  });
});
