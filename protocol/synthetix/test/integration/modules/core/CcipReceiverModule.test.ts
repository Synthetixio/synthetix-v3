import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';

import { bn, bootstrapWithStakedPool } from '../../bootstrap';

describe('CcipReceiverModule', function () {
  const { owner, signers, systems, staker, accountId, poolId, collateralAddress } =
    bootstrapWithStakedPool();

  let FakeCcip: ethers.Signer;
  const fiftyUSD = bn(50);
  const twoHundredUSD = bn(200);

  let proxyBalanceBefore: ethers.BigNumber, stakerBalanceBefore: ethers.BigNumber;

  const abiCoder = new ethers.utils.AbiCoder();

  before('identify signers', async () => {
    [FakeCcip] = signers();
  });

  before('set ccip settings', async () => {
    await systems()
      .Core.connect(owner())
      .configureChainlinkCrossChain(await FakeCcip.getAddress(), ethers.constants.AddressZero);

    await systems()
      .Core.connect(owner())
      .setSupportedCrossChainNetworks([1234, 2192], [1234, 2192]);
  });

  before('get some snxUSD', async () => {
    await systems()
      .Core.connect(staker())
      .mintUsd(accountId, poolId, collateralAddress(), twoHundredUSD);

    await systems().Core.connect(staker()).withdraw(accountId, collateralAddress(), fiftyUSD);
  });

  before('record balances', async () => {
    stakerBalanceBefore = await systems()
      .USD.connect(staker())
      .balanceOf(await staker().getAddress());
    proxyBalanceBefore = await systems().USD.connect(staker()).balanceOf(systems().Core.address);
  });

  describe('ccipReceive()', () => {
    it('fails if caller is not CCIP router', async () => {
      await assertRevert(
        systems()
          .Core.connect(staker())
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainSelector: 1234,
            sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
            data: '0x',
            tokenAmounts: [],
          }),
        `NotCcipRouter("${await staker().getAddress()}")`,
        systems().Core
      );
    });

    it('fails if chain is not supported', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeCcip)
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainSelector: 1111,
            sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
            data: '0x',
            tokenAmounts: [],
          }),
        `UnsupportedNetwork("0")`,
        systems().Core
      );
    });

    it('fails if message sender on other chain is not self', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeCcip)
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainSelector: 1234,
            sender: ethers.utils.defaultAbiCoder.encode(['address'], [await FakeCcip.getAddress()]),
            data: '0x',
            tokenAmounts: [],
          }),
        'Unauthorized(',
        systems().Core
      );
    });

    it('fails if token amount data is invalid', async () => {
      await assertRevert(
        systems()
          .Core.connect(FakeCcip)
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainSelector: 1234,
            sender: ethers.utils.defaultAbiCoder.encode(['address'], [systems().Core.address]),
            data: abiCoder.encode(['address'], [await staker().getAddress()]),
            tokenAmounts: [
              {
                token: systems().USD.address,
                amount: fiftyUSD,
              },
              {
                token: systems().USD.address,
                amount: fiftyUSD,
              },
            ],
          }),
        'InvalidMessage()',
        systems().Core
      );
    });

    describe('receives a token amount message', () => {
      let receivedTxn: ethers.providers.TransactionResponse;
      let receipt: ethers.providers.TransactionReceipt;

      before('calls ccip receive', async () => {
        receivedTxn = await systems()
          .Core.connect(FakeCcip)
          .ccipReceive({
            messageId: ethers.constants.HashZero,
            sourceChainSelector: 1234,
            sender: abiCoder.encode(['address'], [systems().Core.address]),
            data: abiCoder.encode(['address'], [await staker().getAddress()]),
            tokenAmounts: [
              {
                token: systems().USD.address,
                amount: fiftyUSD,
              },
            ],
          });

        receipt = await (receivedTxn as ethers.providers.TransactionResponse).wait();
      });

      it('should transfer the snxUSD from the core proxy', async () => {
        const proxyBalanceAfter = await systems()
          .USD.connect(owner())
          .balanceOf(systems().Core.address);
        assertBn.equal(proxyBalanceAfter, proxyBalanceBefore.sub(fiftyUSD));
      });

      it('should increase the stakers balance by the expected amount', async () => {
        const stakerBalanceAfter = await systems()
          .USD.connect(staker())
          .balanceOf(await staker().getAddress());
        assertBn.equal(stakerBalanceAfter, stakerBalanceBefore.add(fiftyUSD));
      });

      describe('emits expected events', () => {
        it('emits a Transfer event', async () => {
          await assertEvent(
            receipt,
            `Transfer("${systems().Core.address}", "${await staker().getAddress()}", ${fiftyUSD})`,
            systems().USD
          );
        });
      });
    });
  });
});
