import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import hre from 'hardhat';
import { ethers } from 'ethers';
import { verifyUsesFeatureFlag } from '../../verifications';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

describe('CrossChainUSDModule', function () {
  const { owner, systems, staker, accountId, poolId, collateralAddress } =
    bootstrapWithStakedPool();

  const fiftyUSD = bn(50);
  const oneHundredUSD = bn(100);

  let stakerAddress: string;
  let proxyBalanceBefore: ethers.BigNumber, stakerBalanceBefore: ethers.BigNumber;
  let CcipRouterMock: ethers.Contract;

  before('identify signers', async () => {
    stakerAddress = await staker().getAddress();
  });

  before('deploy ccip router mock', async () => {
    const factory = await hre.ethers.getContractFactory('CcipRouterMock');
    CcipRouterMock = await factory.connect(owner()).deploy();
  });

  before('configure CCIP', async () => {
    await systems()
      .Core.connect(owner())
      .configureChainlinkCrossChain(CcipRouterMock.address, ethers.constants.AddressZero);
  });

  before('mint some sUSD', async () => {
    await systems()
      .Core.connect(staker())
      .mintUsd(accountId, poolId, collateralAddress(), oneHundredUSD);
  });

  before('record balances', async () => {
    stakerBalanceBefore = await systems().USD.connect(staker()).balanceOf(stakerAddress);
    proxyBalanceBefore = await systems().USD.balanceOf(systems().Core.address);
  });

  describe('transferCrossChain()', () => {
    verifyUsesFeatureFlag(
      () => systems().Core,
      'transferCrossChain',
      () => systems().Core.connect(staker()).transferCrossChain(1, fiftyUSD)
    );

    before('ensure access to feature', async () => {
      await systems()
        .Core.connect(owner())
        .addToFeatureFlagAllowlist(
          ethers.utils.formatBytes32String('transferCrossChain'),
          stakerAddress
        );
    });

    it('reverts if the sender did not set enough allowance', async () => {
      const allowance = await systems()
        .USD.connect(staker())
        .allowance(stakerAddress, systems().Core.address);

      await assertRevert(
        systems().Core.connect(staker()).transferCrossChain(1, oneHundredUSD),
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
        systems().Core.connect(staker()).transferCrossChain(1, excessAmount),
        `InsufficientBalance("${excessAmount}", "${stakerBalanceBefore}")`,
        systems().USD
      );
    });

    describe('successful call', () => {
      let transferCrossChainTxn: ethers.providers.TransactionResponse;

      before('invokes transferCrossChain', async () => {
        await systems()
          .Core.connect(staker())
          .withdraw(accountId, await systems().Core.getUsdToken(), fiftyUSD);
        transferCrossChainTxn = await systems()
          .Core.connect(staker())
          .transferCrossChain(1, fiftyUSD);
      });

      it('should transfer the snxUSD to the core proxy', async () => {
        const usdBalanceAfter = await systems()
          .USD.connect(owner())
          .balanceOf(systems().Core.address);
        assertBn.equal(usdBalanceAfter, proxyBalanceBefore);
      });

      it('should decrease the stakers balance by the expected amount', async () => {
        const usdBalanceAfter = await systems().USD.connect(staker()).balanceOf(stakerAddress);
        assertBn.equal(usdBalanceAfter, 0);
      });

      it('emits correct event with the expected values', async () => {
        await assertEvent(
          transferCrossChainTxn,
          `TransferCrossChainInitiated(1, ${fiftyUSD}, "${stakerAddress}"`,
          systems().Core
        );
      });
    });
  });
});
