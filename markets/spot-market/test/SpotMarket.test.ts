import { ethers as Ethers } from 'ethers';
import { ethers } from 'hardhat';

import { bootstrapWithStakedPool } from '@synthetixio/main/test/integration/bootstrap';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

describe('SpotMarket', function () {
  const { signers, systems, poolId, accountId, depositAmount } = bootstrapWithStakedPool();
  const expectedMarketId = 1;

  let owner: Ethers.Signer, staker1: Ethers.Signer;
  let collateralAddress: string;

  before('identify collateral address', () => {
    collateralAddress = systems().SNX.address;
  });

  before('identify signers', () => {
    [owner, staker1] = signers();
  });

  before('connect market to pool', async () => {
    await systems()
      .Core.connect(owner)
      .setPoolConfiguration(
        poolId,
        [expectedMarketId],
        [ethers.utils.parseEther('1')],
        [ethers.utils.parseEther('1')]
      );
  });

  // Test #s
  const startingAmount = depositAmount.div(10);
  const fee = startingAmount.mul(20).div(10000); // fixed fee manager
  const synthMinted = Ethers.utils.parseEther(startingAmount.sub(fee).toString());

  before('staker mints usd', async () => {
    await systems()
      .Core.connect(staker1)
      .mintUsd(accountId, poolId, collateralAddress, depositAmount.div(5));
  });

  describe('buy', function () {
    let buyTxn: Ethers.providers.TransactionResponse;

    before('buy synth', async () => {
      await systems().USD.connect(staker1).approve(systems().Spot.address, depositAmount.div(10));
      buyTxn = await (await systems().Spot.connect(staker1).buy(depositAmount.div(10))).wait();
    });

    it('emitted event', async () => {
      await assertEvent(buyTxn, `SynthBought(1, ${synthMinted}, ${fee})`, systems().Spot);
    });

    it('transferred correct amount of synth', async () => {
      assertBn.equal(await systems().Spot.balanceOf(await staker1.getAddress()), synthMinted);
    });
  });

  describe('sell', function () {
    let sellTxn: Ethers.providers.TransactionResponse;
    let previousBalance: Ethers.BigNumber;

    // remove 18 decimals for usd conversion
    const synthToSell = synthMinted.div(2);
    const synthToSellInUsd = synthToSell.div(Ethers.BigNumber.from(10).pow(18));

    const expectedFees = synthToSellInUsd.mul(20).div(10000); // fees
    const amountReceived = synthToSellInUsd.sub(expectedFees);

    before('identify staker usd balance', async () => {
      previousBalance = await systems().USD.balanceOf(await staker1.getAddress());
    });

    before('sell synth', async () => {
      sellTxn = await (await systems().Spot.connect(staker1).sell(synthMinted.div(2))).wait();
    });

    it('emitted sell event', async () => {
      await assertEvent(
        sellTxn,
        `SynthSold(1, ${amountReceived}, ${expectedFees})`,
        systems().Spot
      );
    });

    it('transferred correct amount of usd', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await staker1.getAddress()),
        previousBalance.add(amountReceived)
      );
    });
  });
});
