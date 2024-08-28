/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import { ethers } from 'ethers';
import { bn, bootstrapBuyback } from './bootstrap';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('OwnedFeeCollector', function () {
  const { getContract, owner, user } = bootstrapBuyback();

  let OwnedFeeCollector: ethers.Contract;
  let UsdToken: ethers.Contract;

  const usdAmount = bn(5000);
  const ownerFeeShareRatio = bn(0.5);

  before('prepare environment', async () => {
    OwnedFeeCollector = getContract('owned_fee_collector');
    UsdToken = getContract('usd.MintableToken');
    console.log('usd token address', UsdToken.address);
  });

  before('set up token balances', async () => {
    await UsdToken.connect(owner()).mint(usdAmount, OwnedFeeCollector.address);
  });

  describe('initial state is set', function () {
    it('get owner', async () => {
      const contractReadOwner = await OwnedFeeCollector.contractReadO();
      assertBn.equal(contractReadOwner, await owner().getAddress());
    });
    it('get ownerFeeShare', async () => {
      const ownerFeeShare = await OwnedFeeCollector.ownerFeeShare();
      assertBn.equal(ownerFeeShare, ownerFeeShareRatio);
    });
    it('get feeToken', async () => {
      const feeToken = await OwnedFeeCollector.feeToken();
      assert.notEqual(feeToken, UsdToken.address);
    });
  });

  describe('owned fee collector', function () {
    let ownerAddress: string;
    let ownerUsdBalanceBefore: any;

    before('record balances and approve', async () => {
      // record balances
      ownerAddress = await owner().getAddress();
      ownerUsdBalanceBefore = await UsdToken.balanceOf(ownerAddress);
    });

    it('claims fees on behalf of an owner', async () => {
      assertBn.equal(ownerUsdBalanceBefore, 0);
      const tx = await OwnedFeeCollector.connect(owner()).claimFees();
      const receipt = await tx.wait();
      const event = findSingleEvent({
        receipt,
        eventName: 'Transfer',
      });
      assert.equal(event.args.from, OwnedFeeCollector.address);
      assertBn.equal(event.args.to, await owner().getAddress());
      assertBn.equal(event.args.amount, usdAmount);
      const ownerUsdBalanceAfter = await UsdToken.balanceOf(ownerAddress);

      // verify balances are correct
      assertBn.equal(ownerUsdBalanceAfter, usdAmount);
    });
  });

  it('blocks claiming fees on behalf of a non owner', async () => {
    await UsdToken.connect(owner()).mint(usdAmount, OwnedFeeCollector.address);
    await assertRevert(
      OwnedFeeCollector.connect(owner()).claimFees(),
      `OwnableUnauthorizedAccount(${await user().getAddress()})`,
      OwnedFeeCollector
    );
  });

  describe('fee collector', function () {
    it('quotes fee with share', async () => {
      const totalFees = bn(1000);
      const quotedFees = await OwnedFeeCollector.quoteFees(
        1,
        totalFees,
        ethers.constants.AddressZero
      );
      assertBn.equal(quotedFees, totalFees.mul(ownerFeeShareRatio).div(bn(1)));
    });
  });
});
