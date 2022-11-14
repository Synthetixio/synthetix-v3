import hre from 'hardhat';

import assert from 'assert/strict';

import { MockMarket } from '../../../typechain-types/contracts/mocks/MockMarket';

import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { bootstrap } from '../bootstrap';
import { ethers } from 'ethers';

describe('Market', function () {
  const { systems, signers } = bootstrap();

  let owner: ethers.Signer;

  let FakeMarket: MockMarket;

  const fakeMarketId = 2929292;

  before('init', async () => {
    FakeMarket = await (await hre.ethers.getContractFactory('MockMarket')).deploy();
    await FakeMarket.deployed();

    [owner] = signers();

    await systems().Core.connect(owner).Market_set_marketAddress(fakeMarketId, FakeMarket.address);
  });

  describe('getReportedDebt()', async () => {
    it('returns whatever the market sends', async () => {
      await FakeMarket.setReportedDebt(9876);

      assertBn.equal(await systems().Core.Market_getReportedDebt(fakeMarketId), 9876);
    });
  });

  describe('getLockedLiquidity()', async () => {
    it('returns whatever the market sends', async () => {
      await FakeMarket.setLocked(1234);

      assertBn.equal(await systems().Core.Market_getLockedLiquidity(fakeMarketId), 1234);
    });
  });

  describe('totalBalance()', async () => {
    it('returns market debt when no issuance', async () => {
      await FakeMarket.setReportedDebt(1000);

      assertBn.equal(await systems().Core.Market_totalBalance(fakeMarketId), 1000);
    });

    it('adds issuance to market debt', async () => {
      await FakeMarket.setReportedDebt(1000);
      await systems().Core.connect(owner).Market_set_issuance(fakeMarketId, -10000);

      assertBn.equal(await systems().Core.Market_totalBalance(fakeMarketId), -9000);
    });

    // not currently possible due to lack of code to set collateral lock
    it.skip('also subtracts  from market debt', async () => {});
  });

  // not currently possible due to lack of code to set collateral lock
  describe.skip('getDepositedCollateralValue()', async () => {});

  describe('isCapacityLocked()', async () => {
    it('unlocked when no locking', async () => {
      await FakeMarket.setLocked(0);
      await systems().Core.connect(owner).Market_set_capacity(fakeMarketId, 0);

      assert.equal(await systems().Core.Market_isCapacityLocked(fakeMarketId), false);
    });
  });

  describe('rebalance()', async () => {});

  // TODO
  describe.skip('adjustVaultShares()', async () => {
    it('shows market is empty before anyone adjusts in', async () => {});

    describe('pool enters', async () => {
      before('adjust', async () => {
        await systems().Core.connect(owner).invoke_adjustVaultShares();
      });

      it('', async () => {});

      describe('another pool enters', async () => {
        describe('both pools leave', async () => {});
      });
    });
  });

  describe('distributeDebt()', async () => {
    describe('add a couple pools', async () => {});
  });
});
