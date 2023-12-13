/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

import { ethers } from 'ethers';
import { bn, bootstrapBuyback } from './bootstrap';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('BuybackSnx', function () {
  const { getContract, user, owner } = bootstrapBuyback();

  let BuybackSnx: ethers.Contract;
  let SnxToken: ethers.Contract;
  let UsdToken: ethers.Contract;

  const snxPrice = bn(10);
  const snxAmount = bn(100);
  const usdAmount = bn(5000);
  const premiumValue = bn(0.01);
  const snxFeeShareRatio = bn(0.5);

  before('prepare environment', async () => {
    BuybackSnx = getContract('buyback_snx');
    SnxToken = getContract('snx.MintableToken');
    UsdToken = getContract('usd.MintableToken');
    console.log('snx token address', SnxToken.address);
    console.log('usd token address', UsdToken.address);
  });

  before('set up token balances', async () => {
    await SnxToken.connect(owner()).mint(snxAmount, await user().getAddress());
    await UsdToken.connect(owner()).mint(usdAmount, BuybackSnx.address);
  });

  describe('initial state is set', function () {
    it('get premium', async () => {
      const premium = await BuybackSnx.getPremium();
      assertBn.equal(premium, premiumValue);
    });
    it('get snxFeeShare', async () => {
      const snxFeeShare = await BuybackSnx.getSnxFeeShare();
      assertBn.equal(snxFeeShare, snxFeeShareRatio);
    });
    it('get snxNodeId', async () => {
      const snxNodeId = await BuybackSnx.getSnxFeeShare();
      assert.notEqual(snxNodeId, ethers.constants.HashZero);
    });
  });

  describe('buyback', function () {
    let userAddress: string;
    let userSnxBalanceBefore: any;
    let userUsdBalanceBefore: any;
    let buybackSnxBalanceBefore: any;
    let buybackUsdBalanceBefore: any;

    before('record balances and approve', async () => {
      // record balances
      userAddress = await user().getAddress();
      userSnxBalanceBefore = await SnxToken.balanceOf(userAddress);
      userUsdBalanceBefore = await UsdToken.balanceOf(userAddress);
      buybackSnxBalanceBefore = await SnxToken.balanceOf(BuybackSnx.address);
      buybackUsdBalanceBefore = await UsdToken.balanceOf(BuybackSnx.address);
      console.log('userSnxBalanceBefore', userSnxBalanceBefore.toString());
      console.log('userUsdBalanceBefore', userUsdBalanceBefore.toString());
      console.log('buybackSnxBalanceBefore', buybackSnxBalanceBefore.toString());
      console.log('buybackUsdBalanceBefore', buybackUsdBalanceBefore.toString());

      // approve buyback contract to spend SNX
      await SnxToken.connect(user()).approve(BuybackSnx.address, snxAmount);
    });

    it('buys snx for usd', async () => {
      const premium = await BuybackSnx.getPremium();
      console.log('premium', premium.toString());

      console.log(
        '1 + premimum',
        bn(1)
          .add(await BuybackSnx.getPremium())
          .toString()
      );
      console.log('snx price * snx amount ', snxPrice.mul(snxAmount).div(bn(1)).toString());

      const expectedAmountUSD = snxPrice
        .mul(snxAmount)
        .mul(bn(1).add(await BuybackSnx.getPremium()))
        .div(bn(1))
        .div(bn(1));
      console.log('expected usd amount:', expectedAmountUSD.toString());

      const tx = await BuybackSnx.connect(user()).processBuyback(snxAmount);
      const receipt = await tx.wait();
      const event = findSingleEvent({
        receipt,
        eventName: 'BuybackProcessed',
      });

      assert.equal(event.args.buyer, userAddress);
      assertBn.equal(event.args.snx, snxAmount);
      assertBn.equal(event.args.usd, expectedAmountUSD);

      // verify balances are correct
      assertBn.equal(await SnxToken.balanceOf(userAddress), userSnxBalanceBefore.sub(snxAmount));
      assertBn.equal(
        await SnxToken.balanceOf('0x000000000000000000000000000000000000dEaD'),
        snxAmount
      );
      assertBn.equal(
        await UsdToken.balanceOf(userAddress),
        userUsdBalanceBefore.add(expectedAmountUSD)
      );
      assertBn.equal(
        await UsdToken.balanceOf(BuybackSnx.address),
        buybackUsdBalanceBefore.sub(expectedAmountUSD)
      );
    });
  });

  describe('fee collector', function () {
    it('quotes fee with share', async () => {
      const totalFees = bn(1000);
      const quotedFees = await BuybackSnx.quoteFees(1, totalFees, ethers.constants.AddressZero);
      assertBn.equal(quotedFees, totalFees.mul(snxFeeShareRatio).div(bn(1)));
    });
  });
});
