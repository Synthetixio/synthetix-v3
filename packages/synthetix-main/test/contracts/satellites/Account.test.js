const { ethers } = hre;
const assert = require('assert/strict');
// const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
// const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
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

  before('create the account and identify it', async () => {
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
    Collateral = await factory.deploy(systemOwner.address);

    await (await Collateral.connect(systemOwner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('CollateralPriceFeedMock');
    CollateralPriceFeed = await factory.deploy(systemOwner.address);

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

  describe('When the systemOwner adds another collaterals', () => {
    let AnotherCollateral, AnotherCollateralPriceFeed;
    before('add another collateral', async () => {
      let factory;

      factory = await ethers.getContractFactory('CollateralMock');
      AnotherCollateral = await factory.deploy(systemOwner.address);
      await (
        await AnotherCollateral.connect(systemOwner).initialize('Another Token', 'ANT', 18)
      ).wait();

      factory = await ethers.getContractFactory('CollateralPriceFeedMock');
      AnotherCollateralPriceFeed = await factory.deploy(systemOwner.address);

      await (await AnotherCollateralPriceFeed.connect(systemOwner).setCurrentPrice(100)).wait();

      await (
        await AccountModule.connect(systemOwner).addCollateralType(
          AnotherCollateral.address,
          AnotherCollateralPriceFeed.address,
          400,
          200
        )
      ).wait();
    });

    it('emitted an event', async () => {});
    it('is added', async () => {});

    describe('When the systemOwner updates the new collateral data', () => {
      before('updates the collateral', async () => {});
      it('emitted an event', async () => {});
      it('is updated', async () => {});
    });

    describe('When the systemOwner disables the new collateral', () => {
      before('disables the collateral', async () => {});
      it('emitted an event', async () => {});
      it('is disabled', async () => {});
    });
  });
});
