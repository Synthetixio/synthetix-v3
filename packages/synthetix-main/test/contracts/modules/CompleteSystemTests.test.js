const { ethers } = hre;
const assert = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
// const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');
const { takeSnapshot, restoreSnapshot } = require('@synthetixio/core-js/utils/hardhat/rpc');

describe('MarketManager', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner, admin, user1, user2;

  let CollateralModule;
  let Collateral, CollateralPriceFeed;
  let AccountModule; // AccountToken;
  let FundModule, VaultModule;
  let MarketManagerModule;

  let Market1, Market2;
  let account1, account2;
  let market1, market2, fund1;

  const ONE = ethers.utils.parseEther('1');

  before('identify signers', async () => {
    [owner, admin] = await ethers.getSigners();
    [, , user1, user2] = await ethers.getSigners();
  });

  before('identify contracts', async () => {
    FundModule = await ethers.getContractAt('FundModule', proxyAddress());
    VaultModule = await ethers.getContractAt('VaultModule', proxyAddress());

    CollateralModule = await ethers.getContractAt('CollateralModule', proxyAddress());
    AccountModule = await ethers.getContractAt('AccountModule', proxyAddress());
    await (await AccountModule.connect(owner).initializeAccountModule()).wait();

    MarketManagerModule = await ethers.getContractAt('MarketManagerModule', proxyAddress());

    // const accountTokenAddress = await AccountModule.getAccountAddress();
    // AccountToken = await ethers.getContractAt('AccountToken', accountTokenAddress);
  });

  before('add one collateral', async () => {
    let factory;

    factory = await ethers.getContractFactory('CollateralMock');
    Collateral = await factory.deploy();

    await (await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await ethers.getContractFactory('AggregatorV3Mock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(owner).mockSetCurrentPrice(1)).wait();

    await (
      await CollateralModule.connect(owner).adjustCollateralType(
        Collateral.address,
        CollateralPriceFeed.address,
        400,
        200,
        true
      )
    ).wait();
  });

  before('mint some account tokens', async () => {
    account1 = 1;
    account2 = 2;
    await (await AccountModule.connect(user1).createAccount(account1)).wait();
    await (await AccountModule.connect(user2).createAccount(account2)).wait();
  });

  before('mint some collateral to the user', async () => {
    await (await Collateral.mint(user1.address, 1000)).wait();
    await (await Collateral.mint(user2.address, 1000)).wait();
  });

  before('approve AccountModule to operate with the user collateral', async () => {
    await (
      await Collateral.connect(user1).approve(AccountModule.address, ethers.constants.MaxUint256)
    ).wait();
    await (
      await Collateral.connect(user2).approve(AccountModule.address, ethers.constants.MaxUint256)
    ).wait();
  });

  before('configure markets and fund', async () => {
    let receipt, event;
    Market1 = await (await ethers.getContractFactory('MarketMock')).deploy();
    receipt = await (await MarketManagerModule.registerMarket(Market1.address)).wait();
    event = findEvent({ receipt, eventName: 'MarketRegistered' });
    market1 = event.args.marketId;
    await (await Market1.initialize(proxyAddress(), market1)).wait();
    await (await Market1.setPrice(ONE)).wait();

    Market2 = await (await ethers.getContractFactory('MarketMock')).deploy();
    receipt = await (await MarketManagerModule.registerMarket(Market2.address)).wait();
    event = findEvent({ receipt, eventName: 'MarketRegistered' });
    market2 = event.args.marketId;
    await (await Market2.initialize(proxyAddress(), market2)).wait();
    await (await Market2.setPrice(ONE)).wait();

    fund1 = 1;
    await (await FundModule.connect(owner).createFund(fund1, admin.address)).wait();
    await (
      await FundModule.connect(admin).setFundPosition(fund1, [market1, market2], [1, 1], [100, 100])
    ).wait();
  });

  it('is configured', async () => {
    let markets, weights, maxSharePrices;
    [markets, weights, maxSharePrices] = await FundModule.getFundPosition(fund1);
    assert.equal(markets.length, 2);
    assert.equal(weights.length, 2);
    assertBn.equal(markets[0], market1);
    assertBn.equal(markets[1], market2);
    assertBn.equal(weights[0], 1);
    assertBn.equal(weights[1], 1);
    assertBn.equal(maxSharePrices[0], 100);
    assertBn.equal(maxSharePrices[1], 100);
  });

  describe('normal use case', async () => {
    let snapshotId;
    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(ethers.provider);
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, ethers.provider);
    });

    before('set initial conditions', async () => {
      // stake
      await (await CollateralModule.connect(user1).stake(1, Collateral.address, 100)).wait();
      // delegate
      await (
        await VaultModule.connect(user1).delegateCollateral(1, 1, Collateral.address, 100, 1)
      ).wait();
    });

    before('apply changes', async () => {
      // apply changes
      await (await Market1.connect(user2).sellSynth(50)).wait();
    });

    it('xxxxxxx', async () => {
      // should see the expected results
    });
  });

  describe('extreme use cases', async () => {
    let snapshotId;
    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(ethers.provider);
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, ethers.provider);
    });

    before('set initial conditions', async () => {
      // set initial conditions
    });

    before('apply changes', async () => {
      // apply changes
    });

    it('xxxxxxx', async () => {
      // should see the expected results
    });
  });
});
