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

  let CcipRouterMock: ethers.Contract;
  let stakerAddress: string;

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
      .configureChainlinkCrossChain(
        CcipRouterMock.address,
        ethers.constants.AddressZero,
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

    it('reverts if the sender does not have enough snxUSD', async () => {
      const excessAmount = oneHundredUSD.mul(100);
      const usdBalance = await systems().USD.connect(staker()).balanceOf(stakerAddress);

      await assertRevert(
        systems().Core.connect(staker()).transferCrossChain(1, stakerAddress, excessAmount),
        `InsufficientBalance("${excessAmount}", "${usdBalance}")`,
        systems().USD
      );
    });

    describe('successful call', () => {
      let usdBalanceBefore: ethers.BigNumber;
      let transferCrossChainTxn: ethers.providers.TransactionResponse;

      before('record balances', async () => {
        usdBalanceBefore = await systems().USD.connect(staker()).balanceOf(stakerAddress);
      });

      before('transfer 50 snxUSD', async () => {
        transferCrossChainTxn = await systems()
          .Core.connect(staker())
          .transferCrossChain(1, stakerAddress, fiftyUSD);
      });

      it('burns the correct amount of snxUSD on the source chain', async () => {
        const usdBalanceAfter = await systems().USD.connect(staker()).balanceOf(stakerAddress);
        assertBn.equal(usdBalanceAfter, usdBalanceBefore.sub(fiftyUSD));
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
