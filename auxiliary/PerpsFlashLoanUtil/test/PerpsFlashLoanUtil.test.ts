/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { bn, bootstrapUtil } from './bootstrap';
// import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('PerpsFlashLoanUtil', function () {
  const { getContract, user, owner } = bootstrapUtil();

  let perpsFlashLoanUtil: ethers.Contract;
  let usdcToken: ethers.Contract;
  let snxUsdToken: ethers.Contract;
  // let synthetixCore: ethers.Contract;
  // let spotMarketProxy: ethers.Contract;
  // let perpsMarketProxy: ethers.Contract;
  // let quoter: ethers.Contract;
  // let router: ethers.Contract;

  const flashLoanAmount = bn(1000);
  const marketId = 1;
  const accountId = 1;
  const collateralType = ethers.constants.AddressZero; // TODO: replace with mock collateralType address (WETH)

  before('prepare environment', async () => {
    perpsFlashLoanUtil = await getContract('PerpsFlashLoanUtil', owner);
    usdcToken = await getContract('MintableToken', owner);
    snxUsdToken = await getContract('MintableToken', owner);
    // synthetixCore = await getContract('SynthetixCore', owner);
    // spotMarketProxy = await getContract('SpotMarketProxy', owner);
    // perpsMarketProxy = await getContract('PerpsMarketProxy', owner);
    // quoter = await getContract('Quoter', owner);
    // router = await getContract('SwapRouter', owner);

    await usdcToken.mint(user.address, bn(1000000));
    await snxUsdToken.mint(user.address, bn(1000000));
  });

  before('set up token balances', async () => {
    const userUsdcBalance = await usdcToken.balanceOf(user.address);
    const userSnxUsdBalance = await snxUsdToken.balanceOf(user.address);

    assertBn.equal(userUsdcBalance, bn(1000000));
    assertBn.equal(userSnxUsdBalance, bn(1000000));
  });

  describe('initial state is set', function () {
    it('should set initial state correctly', async function () {
      const usdcAddress = await perpsFlashLoanUtil.USDC();
      const snxUsdAddress = await perpsFlashLoanUtil.snxUSD();

      assert.equal(usdcAddress, usdcToken.address);
      assert.equal(snxUsdAddress, snxUsdToken.address);
    });
  });

  describe('flash loan util', function () {
    it('should request flash loan and repay with margin', async function () {
      await usdcToken.connect(user).approve(perpsFlashLoanUtil.address, flashLoanAmount);
      await perpsFlashLoanUtil
        .connect(user)
        .requestFlashLoan(flashLoanAmount, collateralType, marketId, accountId);

      const userUsdcBalanceAfter = await usdcToken.balanceOf(user.address);
      const userSnxUsdBalanceAfter = await snxUsdToken.balanceOf(user.address);

      assertBn.lt(userUsdcBalanceAfter, bn(1000000));
      assertBn.lt(userSnxUsdBalanceAfter, bn(1000000));
    });
  });
});
