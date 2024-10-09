import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';

import { ethers } from 'ethers';
import { bn, bootstrapOwnedFeeCollector } from './bootstrap';

// address _owner, // pDAO
// address _feeShareRecipient, // TC
// uint256 _feeShare, // percent of fees for the protocol after integrator fees
// address _feeToken

describe('OwnedFeeCollector', function () {
  const { getContract, owner, user, feeShareRecipient } = bootstrapOwnedFeeCollector();

  let OwnedFeeCollector: ethers.Contract;
  let UsdToken: ethers.Contract;

  const usdAmount = bn(5000);
  const feeShareRatio = bn(0.5);
  const zeroAddress = ethers.constants.AddressZero;

  before('prepare environment', async () => {
    OwnedFeeCollector = getContract('owned_fee_collector');
    UsdToken = getContract('usd.MintableToken');
    await UsdToken.connect(owner()).mint(usdAmount, OwnedFeeCollector.address);
  });

  it('gets owner', async () => {
    const contractReadOwner = await OwnedFeeCollector.owner();
    assertBn.equal(contractReadOwner, await owner().getAddress());
  });
  it('gets feeShare', async () => {
    const feeShare = await OwnedFeeCollector.feeShare();
    assertBn.equal(feeShare, feeShareRatio);
  });
  it('gets feeShareRecipient', async () => {
    const feeShareRecipientRead = await OwnedFeeCollector.feeShareRecipient();
    assertBn.equal(await feeShareRecipient().getAddress(), feeShareRecipientRead);
  });
  it('gets feeToken', async () => {
    const feeToken = await OwnedFeeCollector.FEE_TOKEN();
    assert.equal(feeToken, UsdToken.address);
  });

  it('quotes fee with share', async () => {
    const totalFees = ethers.BigNumber.from(1000);
    const quotedFees = await OwnedFeeCollector.quoteFees(
      1,
      totalFees.toNumber(),
      ethers.constants.AddressZero
    );
    assertBn.equal(quotedFees, totalFees.mul(feeShareRatio).div(bn(1)));
  });

  it('claims fees on behalf of an owner', async () => {
    const feeShareRecipientAddress = await feeShareRecipient().getAddress();
    const feeShareRecipientUsdBalanceBefore = await UsdToken.balanceOf(feeShareRecipientAddress);
    assertBn.equal(feeShareRecipientUsdBalanceBefore, 0);

    const contractUsdBalanceBefore = await UsdToken.balanceOf(OwnedFeeCollector.address);
    assertBn.equal(contractUsdBalanceBefore, usdAmount);
    const tx = await OwnedFeeCollector.connect(owner()).claimFees();
    await tx.wait();

    const contractUsdBalanceAfter = await UsdToken.balanceOf(OwnedFeeCollector.address);
    const feeShareRecipientUsdBalanceAfter = await UsdToken.balanceOf(feeShareRecipientAddress);

    // verify balances are correct
    assertBn.equal(feeShareRecipientUsdBalanceAfter, usdAmount);
    assertBn.equal(contractUsdBalanceAfter, 0);
  });

  it('claims fees on behalf of a fee share recipient', async () => {
    await UsdToken.connect(owner()).mint(usdAmount, OwnedFeeCollector.address);
    const feeShareRecipientAddress = await feeShareRecipient().getAddress();
    const feeShareRecipientUsdBalanceBefore = await UsdToken.balanceOf(feeShareRecipientAddress);
    assertBn.equal(feeShareRecipientUsdBalanceBefore, usdAmount);

    const contractUsdBalanceBefore = await UsdToken.balanceOf(OwnedFeeCollector.address);
    assertBn.equal(contractUsdBalanceBefore, usdAmount);

    const tx = await OwnedFeeCollector.connect(feeShareRecipient()).claimFees();
    await tx.wait();

    const contractUsdBalanceAfter = await UsdToken.balanceOf(OwnedFeeCollector.address);
    const feeShareRecipientUsdBalanceAfter = await UsdToken.balanceOf(feeShareRecipientAddress);

    // verify balances are correct
    assertBn.equal(feeShareRecipientUsdBalanceAfter, usdAmount.mul(2));
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
  });

  it('sets fee shares set by the owner', async () => {
    const feeShare = await OwnedFeeCollector.feeShare();
    assertBn.equal(feeShare, feeShareRatio);
    const newFeeShareRatio = bn(0.4);

    const tx = await OwnedFeeCollector.connect(owner()).setFeeShare(newFeeShareRatio);
    await tx.wait();

    const newFeeShare = await OwnedFeeCollector.feeShare();
    assertBn.equal(newFeeShare, newFeeShareRatio);
  });

  it('blocks setting fee shares on behalf of a non owner', async () => {
    const newFeeShareRatio = bn(0.4);
    const contractReadFeeShareRecipient = await OwnedFeeCollector.feeShareRecipient();
    assertBn.notEqual(contractReadFeeShareRecipient, await user().getAddress());
    await assertRevert(
      OwnedFeeCollector.connect(user()).setFeeShare(newFeeShareRatio),
      `Unauthorized(${await user().getAddress()})`,
      OwnedFeeCollector
    );
  });

  it('fails to set a new fee share controller with the wrong permission', async () => {
    const contractReadFeeShareController = await OwnedFeeCollector.feeShareRecipient();
    assertBn.notEqual(contractReadFeeShareController, await user().getAddress());
    await assertRevert(
      OwnedFeeCollector.connect(user()).setFeeShareRecipient(await user().getAddress()),
      `Unauthorized(${await user().getAddress()})`,
      OwnedFeeCollector
    );
  });

  it('sets a new fee share recipient', async () => {
    const feeShareRecipientRead = await OwnedFeeCollector.feeShareRecipient();
    assertBn.equal(await feeShareRecipient().getAddress(), feeShareRecipientRead);
    const tempFeeShareRecipientRead = await OwnedFeeCollector.tempFeeShareRecipient();
    assertBn.equal(zeroAddress, tempFeeShareRecipientRead);

    const tx = await OwnedFeeCollector.connect(owner()).setFeeShareRecipient(
      await user().getAddress()
    );
    await tx.wait();

    const sameFeeShareRecipientRead = await OwnedFeeCollector.feeShareRecipient();
    assertBn.equal(await feeShareRecipient().getAddress(), sameFeeShareRecipientRead);
    const newTempFeeShareRecipientRead = await OwnedFeeCollector.tempFeeShareRecipient();
    assertBn.equal(await user().getAddress(), newTempFeeShareRecipientRead);

    const secondTx = await OwnedFeeCollector.connect(user()).acceptFeeShareRecipient();
    await secondTx.wait();

    const newFeeShareRecipientRead = await OwnedFeeCollector.feeShareRecipient();
    assertBn.equal(await user().getAddress(), newFeeShareRecipientRead);

    const zeroTempFeeShareRecipientRead = await OwnedFeeCollector.tempFeeShareRecipient();
    assertBn.equal(zeroAddress, zeroTempFeeShareRecipientRead);
  });
});
