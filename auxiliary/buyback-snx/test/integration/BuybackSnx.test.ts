import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

import { ethers } from 'ethers';
import hre from 'hardhat';
import { bn, bootstrapBuyback } from './bootstrap';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

const parseUnits = ethers.utils.parseUnits;

describe('BuybackSnx', function () {
  const { getContract, user, owner } = bootstrapBuyback();

  let Pyth: ethers.Contract;
  let PythERC7412Wrapper: ethers.Contract;
  let BuybackSnx: ethers.Contract;
  let SnxToken: ethers.Contract;
  let sUSDToken: ethers.Contract;

  let snxNodeId: any;

  const snxAmount = bn(100);
  const sUSDAmount = bn(100000);

  const decimals = 8;
  const price = parseUnits('10', decimals).toString();
  const emaPrice = parseUnits('2', decimals).toString();

  before('prepare environment', async () => {
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    const timestamp = (await hre.ethers.provider.getBlock(blockNumber)).timestamp;

    SnxToken = getContract('snx.MintableToken');
    sUSDToken = getContract('usdc.MintableToken');
    Pyth = getContract('pyth.Pyth');
    PythERC7412Wrapper = getContract('pyth_erc7412_wrapper.PythERC7412Wrapper');
    BuybackSnx = getContract('buyback_snx');

    snxNodeId = await BuybackSnx.snxNodeId();
    console.log('snxNodeId', snxNodeId.toString());

    const resp = await Pyth.createPriceFeedUpdateData(
      snxNodeId,
      price,
      1,
      -decimals,
      emaPrice,
      1,
      timestamp,
      0
    );
    console.log('Pyth.createPriceFeedUpdateData response', resp);

    const fee = await Pyth['getUpdateFee(bytes[])']([resp]);
    await Pyth.updatePriceFeeds([resp], { value: fee });

    const x = await Pyth.getPriceUnsafe(snxNodeId);
    console.log('Pyth.getPriceUnsafe(snxNodeId)', x.toString());
  });

  before('set balances', async () => {
    await SnxToken.connect(owner()).mint(snxAmount, await user().getAddress());
    await sUSDToken.connect(owner()).mint(sUSDAmount, BuybackSnx.address);
  });

  describe('initial state is set', function () {
    it('set premium', async () => {
      const premium = await BuybackSnx.premium();
      assertBn.equal(premium, bn(0.01));
    });
    it('set snxFeeShare', async () => {
      const snxFeeShare = await BuybackSnx.snxFeeShare();
      assertBn.equal(snxFeeShare, bn(0.5));
    });
    it('set oracleManager', async () => {
      const oracleManager = await BuybackSnx.oracleManager();
      assert.notEqual(oracleManager, ethers.constants.AddressZero);
    });
    it('set snxNodeId', async () => {
      const snxNodeId = await BuybackSnx.snxNodeId();
      assert.notEqual(snxNodeId, ethers.constants.HashZero);
    });
    it('set snxToken', async () => {
      const snxToken = await BuybackSnx.snxToken();
      assert.equal(snxToken, SnxToken.address);
    });
    it('set susdToken', async () => {
      const susdToken = await BuybackSnx.susdToken();
      assert.equal(susdToken, sUSDToken.address);
    });
  });

  describe('buyback', function () {
    let userAddress: string;
    let userSnxBalanceBefore: any;
    let buybacksUSDBalanceBefore: any;

    before('record balances and approve', async () => {
      // record balances
      userAddress = await user().getAddress();
      userSnxBalanceBefore = await SnxToken.balanceOf(userAddress);
      buybacksUSDBalanceBefore = await sUSDToken.balanceOf(BuybackSnx.address);

      await SnxToken.connect(user()).approve(BuybackSnx.address, snxAmount);
    });

    it('buys snx for susd', async () => {
      const snxPrice = await PythERC7412Wrapper.getLatestPrice(snxNodeId, 60);
      console.log('PythERC7412Wrapper.getLatestPrice(snxNodeId, 60)', snxPrice.toString());

      const premium = await BuybackSnx.premium();
      console.log('premium', premium.toString());

      console.log(
        '1 + premimum',
        bn(1)
          .add(await BuybackSnx.premium())
          .toString()
      );
      console.log('snx price * snx amount ', snxPrice.mul(snxAmount).div(bn(1)).toString());

      const expectedAmountUSD = snxPrice
        .mul(snxAmount)
        .mul(bn(1).add(await BuybackSnx.premium()))
        .div(bn(1))
        .div(bn(1));
      console.log('expected usd amount:', expectedAmountUSD.toString());

      const tx = await BuybackSnx.connect(user()).buyback(snxAmount);
      const receipt = await tx.wait();
      const event = findSingleEvent({
        receipt,
        eventName: 'Buyback',
      });

      assert.equal(event.args.buyer, userAddress);
      assertBn.equal(event.args.snx, snxAmount);
      assertBn.equal(event.args.susd, expectedAmountUSD);

      // verify balances are correct
      assertBn.equal(await SnxToken.balanceOf(BuybackSnx.address), snxAmount);
      assertBn.equal(await sUSDToken.balanceOf(userAddress), expectedAmountUSD);
      assertBn.equal(await SnxToken.balanceOf(userAddress), userSnxBalanceBefore.sub(snxAmount));
      assertBn.equal(
        await sUSDToken.balanceOf(BuybackSnx.address),
        buybacksUSDBalanceBefore.sub(expectedAmountUSD)
      );
    });
  });
});
