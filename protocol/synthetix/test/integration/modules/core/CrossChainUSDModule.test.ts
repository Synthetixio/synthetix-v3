import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { verifyUsesFeatureFlag } from '../../verifications';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

describe('CrossChainUSDModule', function () {
  const { owner, systems, staker, ccipTokenPool, accountId, poolId, collateralAddress } =
    bootstrapWithStakedPool();

  const fiftyUSD = bn(50);
  const oneHundredUSD = bn(100);

  let ccipTokenPoolAddress: string, stakerAddress: string;
  let ccipTokenPoolBalanceBefore: ethers.BigNumber, stakerBalanceBefore: ethers.BigNumber;
  let CcipRouterMock: ethers.Contract;

  before('identify signers', async () => {
    ccipTokenPoolAddress = await ccipTokenPool().getAddress();
    stakerAddress = await staker().getAddress();
  });

  before('deploy ccip router mock', async () => {
    const factory = await hre.ethers.getContractFactory('CcipRouterMock');
    CcipRouterMock = await factory.connect(owner()).deploy();
  });

  before('configure CCIP', async () => {
    await systems()
      .Core.connect(owner())
      .configureChainlinkCrossChain(
        CcipRouterMock.address,
        await ccipTokenPool().getAddress(),
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

  before('record balances', async () => {
    stakerBalanceBefore = await systems().USD.connect(staker()).balanceOf(stakerAddress);
    ccipTokenPoolBalanceBefore = await systems()
      .USD.connect(staker())
      .balanceOf(ccipTokenPoolAddress);
  });

  describe('transferCrossChain()', () => {
    verifyUsesFeatureFlag(
      () => systems().Core,
      'transferCrossChain',
      () =>
        systems()
          .Core.connect(staker())
          .transferCrossChain(1, ethers.constants.AddressZero, fiftyUSD)
    );

    before('ensure access to feature', async () => {
      await systems()
        .Core.connect(owner())
        .addToFeatureFlagAllowlist(
          ethers.utils.formatBytes32String('transferCrossChain'),
          stakerAddress
        );
    });

    it('reverts if the sender did not set enough allownce', async () => {
      const allowance = await systems()
        .USD.connect(staker())
        .allowance(stakerAddress, systems().Core.address);

      await assertRevert(
        systems().Core.connect(staker()).transferCrossChain(1, stakerAddress, oneHundredUSD),
        `InsufficientAllowance("${oneHundredUSD}", "${allowance}")`,
        systems().USD
      );
    });

    it('reverts if the sender does not have enough snxUSD', async () => {
      const excessAmount = oneHundredUSD.mul(100);

      await systems()
        .USD.connect(staker())
        .approve(await systems().Core.address, excessAmount);

      await assertRevert(
        systems().Core.connect(staker()).transferCrossChain(1, stakerAddress, excessAmount),
        `InsufficientBalance("${excessAmount}", "${stakerBalanceBefore}")`,
        systems().USD
      );
    });

    describe('successful call', () => {
      let transferCrossChainTxn: ethers.providers.TransactionResponse;

      before('invokes transferCrossChain', async () => {
        transferCrossChainTxn = await systems()
          .Core.connect(staker())
          .transferCrossChain(1, stakerAddress, fiftyUSD);
      });

      it('transfers the snxUSD to the CcipTokenPool', async () => {
        const usdBalanceAfter = await systems()
          .USD.connect(ccipTokenPool())
          .balanceOf(ccipTokenPoolAddress);
        assertBn.equal(usdBalanceAfter, ccipTokenPoolBalanceBefore.add(fiftyUSD));
      });

      it('should decrease the staker snxUSD balance by the expected amount', async () => {
        const usdBalanceAfter = await systems().USD.connect(staker()).balanceOf(stakerAddress);
        assertBn.equal(usdBalanceAfter, stakerBalanceBefore.sub(fiftyUSD));
      });

      it('burns the expected amount of snxUSD from the token pool', async () => {
        await systems()
          .USD.connect(ccipTokenPool())['burn(address,uint256)'](ccipTokenPoolAddress, fiftyUSD);

        const usdBalanceAfter = await systems()
          .USD.connect(ccipTokenPool())
          .balanceOf(ccipTokenPoolAddress);
        assertBn.equal(usdBalanceAfter, ccipTokenPoolBalanceBefore);
      });

      it('emits correct event with the expected values', async () => {
        await assertEvent(
          transferCrossChainTxn,
          `TransferCrossChainInitiated(1, "${stakerAddress}", ${fiftyUSD}, "${stakerAddress}"`,
          systems().Core
        );
      });
    });
  });
});
