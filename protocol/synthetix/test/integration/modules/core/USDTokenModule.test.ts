import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
// import { verifyUsesFeatureFlag } from '../../verifications';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

describe.only('USDTokenModule', function () {
  const { owner, systems, staker, accountId, poolId, collateralAddress } =
    bootstrapWithStakedPool();

  const fiftyUSD = bn(50);
  const oneHundredUSD = bn(100);

  let ownerAddress: string, stakerAddress: string;

  before('identify signers', async () => {
    ownerAddress = await owner().getAddress();
    stakerAddress = await staker().getAddress();
  });

  before('configure CCIP', async () => {
    await systems().Core.connect(owner()).configureChainlinkCrossChain(
      ethers.constants.AddressZero,
      stakerAddress, // fake CCIP token pool address
      ethers.constants.AddressZero
    );
  });

  before('get some snxUSD', async () => {
    await systems()
      .Core.connect(staker())
      .mintUsd(accountId, poolId, collateralAddress(), oneHundredUSD);

    await systems()
      .Core.connect(staker())
      .withdraw(accountId, systems().USD.address, oneHundredUSD);
  });

  it('USD is deployed and registered', async () => {
    const info = await systems().Core.getAssociatedSystem(
      ethers.utils.formatBytes32String('USDToken')
    );
    assert.equal(info.addr, systems().USD.address);
  });

  it('applied the USD parameters', async () => {
    assert.equal(await systems().USD.name(), 'Synthetic USD Token v3');
    assert.equal(await systems().USD.symbol(), 'snxUSD');
    assert.equal(await systems().USD.decimals(), 18);
  });

  describe('burn(uint256)', () => {
    it('reverts if not authorized', async () => {
      await assertRevert(
        systems().USD.connect(owner())['burn(uint256)'](oneHundredUSD),
        `Unauthorized("${ownerAddress}")`,
        systems().USD
      );
    });

    describe('successful call', () => {
      let usdBalanceBefore: ethers.BigNumber;

      before('record balances', async () => {
        usdBalanceBefore = await systems().USD.connect(staker()).balanceOf(stakerAddress);
      });

      before('burn 50 snxUSD', async () => {
        await systems().USD.connect(staker())['burn(uint256)'](fiftyUSD);
      });

      it('properly reflects the amount of snxUSD burned from the caller', async () => {
        const usdBalanceAfter = await systems().USD.connect(staker()).balanceOf(stakerAddress);
        assertBn.equal(usdBalanceAfter, usdBalanceBefore.sub(fiftyUSD));
      });
    });
  });

  describe('transferCrossChain()', () => {
    // verifyUsesFeatureFlag(
    //   () => systems().Core,
    //   'transferCrossChain',
    //   () =>
    //     systems()
    //       .USD.connect(staker())
    //       .transferCrossChain(1, ethers.constants.AddressZero, usdAmount)
    // );

    // before('ensure access to feature', async () => {
    //   await systems()
    //     .Core.connect(owner())
    //     .addToFeatureFlagAllowlist(
    //       ethers.utils.formatBytes32String('transferCrossChain'),
    //       stakerAddress
    //     );
    // });

    it('reverts if the sender does not have enough snxUSD', async () => {
      const excessAmount = oneHundredUSD.mul(100);
      const usdBalance = await systems().USD.connect(staker()).balanceOf(stakerAddress);

      await assertRevert(
        systems().USD.connect(staker()).transferCrossChain(1, stakerAddress, excessAmount),
        `InsufficientBalance("${excessAmount}", "${usdBalance}")`,
        systems().USD
      );
    });

    describe('successful call', () => {
      let gasRefunded: ethers.BigNumber;
      let usdBalanceBefore: ethers.BigNumber;
      let transferCrossChainTxn: ethers.providers.TransactionResponse;

      before('record balances', async () => {
        usdBalanceBefore = await systems().USD.connect(staker()).balanceOf(stakerAddress);
      });

      before('transfer 50 snxUSD', async () => {
        transferCrossChainTxn = await systems()
          .USD.connect(staker())
          .transferCrossChain(1, stakerAddress, fiftyUSD);
      });

      it('burns the correct amount of snxUSD on the source chain', async () => {
        const usdBalanceAfter = await systems().USD.connect(staker()).balanceOf(stakerAddress);
        assertBn.equal(usdBalanceAfter, usdBalanceBefore.sub(fiftyUSD));
      });

      it('refunds the correct amount of left over gas', async () => {
        console.log(transferCrossChainTxn.r?.toString());
        console.log(gasRefunded);
      });

      it('transfers the fee into the contract and notifies the rewards distributor', async () => {});

      it('triggers cross chain transfer call', async () => {
        // calls ccipSend with the expected encoded data (recipient, amount, destChainId)
      });

      it('emits correct event with the expected values', async () => {
        await assertEvent(
          transferCrossChainTxn,
          `TransferCrossChainInitiated(1, "${stakerAddress}", ${fiftyUSD}, "${stakerAddress}"`,
          systems().USD
        );
      });
    });
  });
});
