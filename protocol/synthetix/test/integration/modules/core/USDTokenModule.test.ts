import assertBn from '@synthetixio/core-utils/src/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assert from 'assert/strict';
import { ethers } from 'ethers';
import { bn, bootstrapWithStakedPool } from '../../bootstrap';

describe('USDTokenModule', function () {
  const { owner, systems, staker, accountId, poolId, collateralAddress } =
    bootstrapWithStakedPool();

  const fiftyUSD = bn(50);
  const oneHundredUSD = bn(100);

  let ownerAddress: string, stakerAddress: string;

  before('identify signers', async () => {
    ownerAddress = await owner().getAddress();
    stakerAddress = await staker().getAddress();
  });

  before('get some snxUSD', async () => {
    await systems()
      .Core.connect(staker())
      .mintUsd(accountId, poolId, collateralAddress(), oneHundredUSD);

    // await systems()
    //   .Core.connect(staker())
    //   .withdraw(accountId, systems().USD.address, oneHundredUSD);
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
    before('configure CCIP', async () => {
      await systems().Core.connect(owner()).configureChainlinkCrossChain(
        ethers.constants.AddressZero,
        stakerAddress // fake CCIP token pool address
      );
    });

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
        await systems()
          .Core.connect(staker())
          .withdraw(accountId, await systems().Core.getUsdToken(), fiftyUSD);
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
});
