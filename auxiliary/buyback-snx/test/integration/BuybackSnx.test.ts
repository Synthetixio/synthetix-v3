import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import hre from 'hardhat';
import { ethers } from 'ethers';
import { bn, bootstrapWithNodes } from './bootstrap';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('BuybackSnx', function () {
  const { getContract, owner, user } = bootstrapWithNodes();

  let ERC20: ethers.Contract;
  let BuybackSnx: ethers.Contract;

  before('prepare environment', async () => {
    BuybackSnx = getContract('BuybackSnx');
  });

  before('deploy mock token', async () => {
    const factory = await hre.ethers.getContractFactory('ERC20Mock');
    ERC20 = await factory.connect(owner()).deploy();
    const tx = await ERC20.initialize('Synthetix Network Token', 'snx', 18);
    await tx.wait();
  });

  describe('initial config', function () {
    it('init treasury', async () => {
      const treasury = await BuybackSnx.treasury();
      assert.equal(treasury, await owner().getAddress());
    });
    it('init premium', async () => {
      const premium = await BuybackSnx.premium();
      assertBn.equal(premium, bn(0.01));
    });
    it('init snxNodeId', async () => {
      const snxNodeId = await BuybackSnx.snxNodeId();
      assert.equal(snxNodeId, ethers.constants.HashZero);
    });
  });

  describe('setters', function () {
    describe('set treasury', function () {
      it('reverts if not owner', async () => {
        await assertRevert(
          BuybackSnx.connect(user()).setTreasury(ethers.constants.AddressZero),
          'Unauthorized',
          BuybackSnx
        );
      });

      it('updates treasury', async () => {
        const newTreasury = ethers.constants.AddressZero;

        const tx = await BuybackSnx.setTreasury(newTreasury);
        const receipt = await tx.wait();

        const event = findSingleEvent({
          receipt,
          eventName: 'UpdateTreasury',
        });

        assert.equal(event.args.newTreasury, newTreasury);
      });
    });

    describe('set premium', function () {
      it('reverts if not owner', async () => {
        await assertRevert(
          BuybackSnx.connect(user()).setTreasury(ethers.constants.AddressZero),
          'Unauthorized',
          BuybackSnx
        );
      });

      it('reverts if invalid premium value', async () => {
        await assertRevert(
          BuybackSnx.connect(owner()).setPremium(ethers.constants.MaxUint256),
          'Invalid premium value',
          BuybackSnx
        );
      });

      it('updates premium', async () => {
        const newPremium = bn(0.05);

        const tx = await BuybackSnx.setPremium(newPremium);
        const receipt = await tx.wait();

        const event = findSingleEvent({
          receipt,
          eventName: 'UpdatePremium',
        });

        assertBn.equal(event.args.newPremium, newPremium);
      });
    });

    describe('set snxNodeId', function () {
      it('reverts if not owner', async () => {
        await assertRevert(
          BuybackSnx.connect(user()).setNodeId(ethers.constants.HashZero),
          'Unauthorized',
          BuybackSnx
        );
      });

      it('updates snxNodeId', async () => {
        const newNodeId = '0xe956a4199936e913b402474cb29576066f15108121d434606a19b34036e6d5cc';

        const tx = await BuybackSnx.setNodeId(newNodeId);
        const receipt = await tx.wait();

        const event = findSingleEvent({
          receipt,
          eventName: 'UpdateNodeId',
        });

        assert.equal(event.args.newNodeId, newNodeId);
      });
    });
  });

  describe('buyback', function () {
    // setup mock oracle node

    // failure conditions

    // successful buyback, emits event
    it('succeeds', async () => {
      const snxAmount = bn(100);
      ERC20.mintFor(await user().getAddress, snxAmount);

      const tx = await BuybackSnx.connect(user()).buySnx(snxAmount);
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

  describe('sweep', function () {
    // failure conditions
    // ownership check

    // successful token sweep
    it('succeeds', async () => {
      const balanceBefore = await ERC20.balanceOf(BuybackSnx.address);

      const tx = await BuybackSnx.connect(owner()).sweep(
        ERC20.address,
        ethers.constants.MaxUint256
      );
      const receipt = await tx.wait();

      const event = findSingleEvent({
        receipt,
        eventName: 'Transfer',
      });

      assert.equal(event.args.from, BuybackSnx.address);
      assertBn.equal(event.args.to, await BuybackSnx.treasury());
      assertBn.equal(event.args.amount, balanceBefore);
    });
  });

  describe('fee collecting', function () {
    // test incoming fees
    // test fee share/distribution
    // test converting sUSD to sUSDC and unwrapping
  });
});
