import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
// import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import { ethers } from 'ethers';
import { bn, bootstrapBuyback } from './bootstrap';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('BuybackSnx', function () {
  const { getContract, user } = bootstrapBuyback();

  let BuybackSnx: ethers.Contract;

  before('prepare environment', async () => {
    BuybackSnx = getContract('BuybackSnx');
  });

  describe('initial config', function () {
    it('init premium', async () => {
      const premium = await BuybackSnx.premium();
      assertBn.equal(premium, bn(0.01));
    });
    it('init oracleManager', async () => {
      const oracleManager = await BuybackSnx.oracleManager();
      assert.equal(oracleManager, ethers.constants.AddressZero);
    });
    it('init snxNodeId', async () => {
      const snxNodeId = await BuybackSnx.snxNodeId();
      assert.equal(snxNodeId, ethers.constants.HashZero);
    });
    it('init snxToken', async () => {
      const snxToken = await BuybackSnx.snxToken();
      assert.equal(snxToken, ethers.constants.AddressZero);
    });
    it('init usdcToken', async () => {
      const usdcToken = await BuybackSnx.usdcToken();
      assert.equal(usdcToken, ethers.constants.AddressZero);
    });
  });

  describe('buyback', function () {
    // failure conditions

    // successful buyback, emits event
    it('succeeds', async () => {
      const snxAmount = bn(100);
      // ERC20.mintFor(await user().getAddress, snxAmount);

      const tx = await BuybackSnx.connect(user()).buyback(snxAmount);
      const receipt = await tx.wait();

      const event = findSingleEvent({
        receipt,
        eventName: 'Buyback',
      });

      assert.equal(event.args.buyer, await user().getAddress());
      assertBn.equal(event.args.snx, snxAmount);
      assertBn.equal(event.args.usdc, snxAmount);

      // verify balances are correct
    });
  });

  describe('fee collecting', function () {
    // test incoming fees
    // test fee share/distribution
    // test converting sUSD to sUSDC and unwrapping
  });
});
