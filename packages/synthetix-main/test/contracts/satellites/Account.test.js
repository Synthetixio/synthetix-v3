const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
// const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
// const { isTypedArray } = require('util/types');

describe('Account', function () {
  const { proxyAddress } = bootstrap(initializer);

  let AccountModule, accountAddress, Account;
  let Collateral, CollateralPriceFeed;

  let systemOwner;

  before('identify signers', async () => {
    [systemOwner] = await ethers.getSigners();
  });

  before('create and identify Account contract', async () => {
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());

    await (await AccountModule.connect(systemOwner).initializeAccountModule()).wait();
    assert.equal(await AccountModule.isAccountModuleInitialized(), true);

    accountAddress = await AccountModule.getAccountAddress();
    Account = await ethers.getContractAt('Account', accountAddress);
    assert.equal(await Account.isAccountInitialized(), true);
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
    assert.equal((await Account.getCollateralTypes())[0], Collateral.address);

    const collateralType = await Account.getCollateralType(Collateral.address);
    assert.equal(collateralType[0], CollateralPriceFeed.address);
    assertBn.equal(collateralType[1], 400);
    assertBn.equal(collateralType[2], 200);
    assert.equal(collateralType[3], false);
  });

  describe('When operating with the callateral', () => {
    describe('when an account is minted', () => {
      describe('when some collateral is staked', () => {
        describe('when some collateral is unstaked', () => {});
      });

      describe('when an unauthorized address tries to operate in the account', () => {
        it('reverts when trying to stake', async () => {});
        it('reverts when trying to unstake', async () => {});
        it('reverts when trying to grant access', async () => {});
      });

      describe('when an authorized address operates with the account', () => {
        describe('when some collateral is staked', () => {
          describe('when some collateral is unstaked', () => {});
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
      const collaterals = await Account.getCollateralTypes();
      assert.equal(collaterals[1], AnotherCollateral.address);
    });

    it('has the right configuration', async () => {
      const collateralType = await Account.getCollateralType(AnotherCollateral.address);
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
        const collateralType = await Account.getCollateralType(AnotherCollateral.address);
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
        const collateralType = await Account.getCollateralType(AnotherCollateral.address);
        assert.equal(collateralType[3], true);
      });
    });
  });
});
