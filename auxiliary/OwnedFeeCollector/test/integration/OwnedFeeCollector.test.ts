/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import { ethers } from 'ethers';
import { bn, bootstrapOwnedFeeCollector } from './bootstrap';

describe('OwnedFeeCollector', function () {
  const { getContract, owner, user } = bootstrapOwnedFeeCollector();

  let OwnedFeeCollector: ethers.Contract;
  let UsdToken: ethers.Contract;

  const usdAmount = bn(5000);
  const ownerFeeShareRatio = bn(0.5);

  before('prepare environment', async () => {
    OwnedFeeCollector = getContract('owned_fee_collector');
    UsdToken = getContract('usd.MintableToken');
    await UsdToken.connect(owner()).mint(usdAmount, OwnedFeeCollector.address);
  });

  it('gets owner', async () => {
    const contractReadOwner = await OwnedFeeCollector.owner();
    assertBn.equal(contractReadOwner, await owner().getAddress());
  });
  it('gets ownerFeeShare', async () => {
    const ownerFeeShare = await OwnedFeeCollector.ownerFeeShare();
    assertBn.equal(ownerFeeShare, ownerFeeShareRatio);
  });
  it('gets feeToken', async () => {
    const feeToken = await OwnedFeeCollector.feeToken();
    assert.equal(feeToken, UsdToken.address);
  });

  it('claims fees on behalf of an owner', async () => {
    const ownerAddress = await owner().getAddress();
    const ownerUsdBalanceBefore = await UsdToken.balanceOf(ownerAddress);
    assertBn.equal(ownerUsdBalanceBefore, 0);

    const contractUsdBalanceBefore = await UsdToken.balanceOf(OwnedFeeCollector.address);
    assertBn.equal(contractUsdBalanceBefore, usdAmount);

    const tx = await OwnedFeeCollector.connect(owner()).claimFees();
    await tx.wait();

    const contractUsdBalanceAfter = await UsdToken.balanceOf(OwnedFeeCollector.address);
    const ownerUsdBalanceAfter = await UsdToken.balanceOf(ownerAddress);

    // verify balances are correct
    assertBn.equal(ownerUsdBalanceAfter, usdAmount);
    assertBn.equal(contractUsdBalanceAfter, 0);
  });

  it('blocks claiming fees on behalf of a non owner', async () => {
    const contractUsdBalance = await UsdToken.balanceOf(OwnedFeeCollector.address);
    assertBn.equal(contractUsdBalance, 0);
    await UsdToken.connect(owner()).mint(usdAmount, OwnedFeeCollector.address);
    const contractUsdBalanceBeforeClaim = await UsdToken.balanceOf(OwnedFeeCollector.address);
    assertBn.equal(contractUsdBalanceBeforeClaim, usdAmount);
    const contractReadOwner = await OwnedFeeCollector.owner();
    assertBn.notEqual(contractReadOwner, await user().getAddress());
    await assertRevert(
      OwnedFeeCollector.connect(user()).claimFees(),
      `Unauthorized(${await user().getAddress()})`,
      OwnedFeeCollector
    );
    const contractUsdBalanceAfterClaim = await UsdToken.balanceOf(OwnedFeeCollector.address);
    assertBn.equal(contractUsdBalanceAfterClaim, usdAmount);
  });

  it('quotes fee with share', async () => {
    const totalFees = ethers.BigNumber.from(1000);
    const quotedFees = await OwnedFeeCollector.quoteFees(
      1,
      totalFees.toNumber(),
      ethers.constants.AddressZero
    );
    assertBn.equal(quotedFees, totalFees.mul(ownerFeeShareRatio).div(bn(1)));
  });
});
