import { ethers as Ethers } from 'ethers';
import { ethers } from 'hardhat';

import { bootstrapWithStakedPool } from '@synthetixio/main/test/integration/bootstrap';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

describe('SpotMarket', function () {
  const { signers, systems, poolId, accountId, depositAmount } = bootstrapWithStakedPool();
  const expectedMarketId = 1;

  let owner: Ethers.Signer, staker1: Ethers.Signer, marketOwner: Ethers.Signer;
  let fixedFeeManager: Ethers.Contract, spotMarket: Ethers.Contract;
  let collateralAddress: string;

  before('identify collateral address', () => {
    collateralAddress = systems().SNX.address;
  });

  before('identify signers', () => {
    [owner, staker1, marketOwner] = signers();
  });

  before('deploy fee manager', async () => {
    const factory = await ethers.getContractFactory('FixedFeeManager');
    fixedFeeManager = await factory
      .connect(marketOwner)
      .deploy(await marketOwner.getAddress(), systems().USD.address, systems().Core.address, 20);
  });

  before('deploy spot market', async () => {
    const factory = await ethers.getContractFactory('SpotMarket');
    spotMarket = await factory
      .connect(marketOwner)
      .deploy(await marketOwner.getAddress(), systems().Core.address, systems().USD.address);
  });

  const name = 'Synthetix BTC';
  const symbol = 'snxBTC';
  const decimals = 18;

  let synthRegisterTxn: Ethers.providers.TransactionResponse;

  before('register synth', async () => {
    synthRegisterTxn = await (
      await spotMarket
        .connect(marketOwner)
        .registerSynth(
          name,
          symbol,
          decimals,
          Ethers.constants.AddressZero,
          fixedFeeManager.address
        )
    ).wait();
  });

  it('emits event', async () => {
    await assertEvent(synthRegisterTxn, `SynthRegistered(${expectedMarketId})`, spotMarket);
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
  let snxBtc: Ethers.Contract;
  before('identify snxBtc', async () => {
    const market = await spotMarket.getMarket(expectedMarketId);

    snxBtc = await ethers.getContractAt('Synth', market.synth);
  });

  before('staker mints usd', async () => {
    await systems()
      .Core.connect(staker1)
      .mintUsd(accountId, poolId, collateralAddress, depositAmount.div(5));
  });

  describe('buy', function () {
    let buyTxn: Ethers.providers.TransactionResponse;

    before('buy synth', async () => {
      await systems().USD.connect(staker1).approve(spotMarket.address, depositAmount.div(10));
      buyTxn = await (
        await spotMarket.connect(staker1).buy(expectedMarketId, depositAmount.div(10))
      ).wait();
    });

    it('emitted event', async () => {
      await assertEvent(buyTxn, `SynthBought(1, ${synthMinted}, ${fee})`, spotMarket);
    });

    it('transferred correct amount of synth', async () => {
      assertBn.equal(await snxBtc.balanceOf(await staker1.getAddress()), synthMinted);
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
      sellTxn = await (
        await spotMarket.connect(staker1).sell(expectedMarketId, synthMinted.div(2))
      ).wait();
    });

    it('emitted sell event', async () => {
      await assertEvent(sellTxn, `SynthSold(1, ${amountReceived}, ${expectedFees})`, spotMarket);
    });

    it('transferred correct amount of usd', async () => {
      assertBn.equal(
        await systems().USD.balanceOf(await staker1.getAddress()),
        previousBalance.add(amountReceived)
      );
    });
  });

  describe('exchange', async () => {
    const idiotMarketId = 2;
    let exchangeTxn: Ethers.providers.TransactionResponse;

    before('register another synth', async () => {
      await (
        await spotMarket
          .connect(marketOwner)
          .registerSynth(
            'Synthetix Idiot',
            'sIDIOT',
            18,
            Ethers.constants.AddressZero,
            fixedFeeManager.address
          )
      ).wait();
    });

    const synthToExchange = synthMinted.div(4);
    const synthToExchangeInUsd = synthToExchange.div(Ethers.BigNumber.from(10).pow(18));
    const expectedFees = synthToExchangeInUsd.mul(20).div(10000);
    const synthReceived = Ethers.utils.parseEther(
      synthToExchangeInUsd.sub(expectedFees).toString()
    );

    before('exchange to sIDIOT', async () => {
      await systems().USD.connect(staker1).approve(spotMarket.address, depositAmount.div(10));
      exchangeTxn = await (
        await spotMarket.connect(staker1).exchange(expectedMarketId, idiotMarketId, synthToExchange)
      ).wait();
    });

    it('emits event', async () => {
      await assertEvent(
        exchangeTxn,
        `SynthExchanged(${expectedMarketId}, ${idiotMarketId}, ${synthReceived}, ${expectedFees})`,
        spotMarket
      );
    });
  });
});
