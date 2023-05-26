import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { verifyUsesFeatureFlag } from '../../verifications';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

describe('USDTokenModule', function () {
  const { owner, systems, staker, accountId, poolId, collateralAddress } =
    bootstrapWithStakedPool();

  const usdAmount = bn(100);

  let stakerAddress: string;

  before('identify signers', async () => {
    stakerAddress = await staker().getAddress();
  });

  before('get some snxUSD', async () => {
    await systems()
      .Core.connect(staker())
      .mintUsd(accountId, poolId, collateralAddress(), usdAmount);

    await systems().Core.connect(staker()).withdraw(accountId, systems().USD.address, usdAmount);
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
        systems().USD.connect(staker())['burn(uint256)'](usdAmount),
        `Unauthorized("${stakerAddress}")`,
        systems().USD
      );
    });

    describe('successful call', () => {
      let usdBalanceBefore: ethers.BigNumber;

      before('record balances', async () => {
        usdBalanceBefore = await systems().USD.connect(staker()).balanceOf(stakerAddress);
      });

      before('configure CCIP', async () => {
        await systems()
          .Core.connect(owner())
          .configureChainlinkCrossChain(stakerAddress, stakerAddress, stakerAddress);
      });

      before('burn snxUSD', async () => {
        await systems().USD.connect(staker())['burn(uint256)'](usdAmount);
      });

      it('properly reflects the amount of snxUSD burned from the caller', async () => {
        const usdBalanceAfter = await systems().USD.connect(staker()).balanceOf(stakerAddress);
        assertBn.equal(usdBalanceAfter, usdBalanceBefore.sub(usdAmount));
      });
    });
  });

  describe('transferCrossChain()', () => {
    verifyUsesFeatureFlag(
      () => systems().Core,
      'transferCrossChain',
      () =>
        systems()
          .USD.connect(staker())
          .transferCrossChain(1, ethers.constants.AddressZero, usdAmount)
    );

    it('only works if user has enough snxUSD', async () => {});

    describe('successful call', () => {
      it('burns the correct amount of snxUSD on the source chain', async () => {});

      it('triggers cross chain transfer call', async () => {});
    });
  });
});
