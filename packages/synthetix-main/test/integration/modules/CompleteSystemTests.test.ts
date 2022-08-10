import hre from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/utils/assertions/assert-bignumber';
// import assertRevert from '@synthetixio/core-js/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/utils/ethers/events';
import { bootstrap } from '../bootstrap';
import { takeSnapshot, restoreSnapshot } from '@synthetixio/core-js/utils/hardhat/rpc';

import { ethers } from 'ethers';

describe('MarketManager', function () {
  const { provider, signers, systems } = bootstrap();

  let owner: ethers.Signer, admin: ethers.Signer, user1: ethers.Signer, user2: ethers.Signer;

  let Collateral: ethers.Contract, CollateralPriceFeed: ethers.Contract;

  let Market1: ethers.Contract, Market2: ethers.Contract;
  let account1, account2;
  let market1: number, market2: number, fund1: number;

  const ONE = ethers.utils.parseEther('1');

  before('identify signers', async () => {
    [owner, admin, user1, user2] = signers();
  });

  before('add one collateral', async () => {
    let factory;

    factory = await hre.ethers.getContractFactory('CollateralMock');
    Collateral = await factory.deploy();

    await (await Collateral.connect(owner).initialize('Synthetix Token', 'SNX', 18)).wait();

    factory = await hre.ethers.getContractFactory('AggregatorV3Mock');
    CollateralPriceFeed = await factory.deploy();

    await (await CollateralPriceFeed.connect(owner).mockSetCurrentPrice(1)).wait();

    await (
      await systems().Core.connect(owner).adjustCollateralType(
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
    await (await systems().Core.connect(user1).createAccount(account1)).wait();
    await (await systems().Core.connect(user2).createAccount(account2)).wait();
  });

  before('mint some collateral to the user', async () => {
    await (await Collateral.mint(await user1.getAddress(), 1000)).wait();
    await (await Collateral.mint(await user2.getAddress(), 1000)).wait();
  });

  before('approve systems().Core to operate with the user collateral', async () => {
    await (
      await Collateral.connect(user1).approve(systems().Core.address, ethers.constants.MaxUint256)
    ).wait();
    await (
      await Collateral.connect(user2).approve(systems().Core.address, ethers.constants.MaxUint256)
    ).wait();
  });

  before('configure markets and fund', async () => {
    let receipt, event;
    Market1 = await (await hre.ethers.getContractFactory('MarketMock')).deploy();
    receipt = await (await systems().Core.registerMarket(Market1.address)).wait();
    event = findEvent({ receipt, eventName: 'MarketRegistered' });
    market1 = event.args.marketId;
    await (await Market1.initialize(systems().Core.address, market1)).wait();
    await (await Market1.setPrice(ONE)).wait();

    Market2 = await (await hre.ethers.getContractFactory('MarketMock')).deploy();
    receipt = await (await systems().Core.registerMarket(Market2.address)).wait();
    event = findEvent({ receipt, eventName: 'MarketRegistered' });
    market2 = event.args.marketId;
    await (await Market2.initialize(systems().Core.address, market2)).wait();
    await (await Market2.setPrice(ONE)).wait();

    fund1 = 1;
    await (await systems().Core.connect(owner).createFund(fund1, await admin.getAddress())).wait();
    await (
      await systems().Core.connect(admin).setFundPosition(fund1, [market1, market2], [1, 1], [100, 100])
    ).wait();
  });

  it('is configured', async () => {
    let markets, weights, maxSharePrices;
    [markets, weights, maxSharePrices] = await systems().Core.getFundPosition(fund1);
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
    let snapshotId: any;
    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(provider());
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, provider());
    });

    before('set initial conditions', async () => {
      // stake
      await (await systems().Core.connect(user1).stake(1, Collateral.address, 100)).wait();
      // delegate
      await (
        await systems().Core.connect(user1).delegateCollateral(1, 1, Collateral.address, 100, 1)
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
    let snapshotId: any;
    before('take snapshot', async function () {
      snapshotId = await takeSnapshot(provider());
    });

    after('restore snapshot', async function () {
      await restoreSnapshot(snapshotId, provider());
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
