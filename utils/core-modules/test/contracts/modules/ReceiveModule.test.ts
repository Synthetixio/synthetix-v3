import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { ReceiveModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe.only('ReceiveModule', function () {
  const { getContractBehindProxy, getSigners, getProvider } = bootstrap({
    implementation: 'SampleRouter',
  });

  let ReceiveModule: ReceiveModule;
  let user: ethers.Signer;
  let userBalanceBefore: ethers.BigNumber;
  let systemBalanceBefore: ethers.BigNumber;

  before('identify signers', async function () {
    [user] = getSigners();
  });

  before('identify contracts', function () {
    ReceiveModule = getContractBehindProxy('ReceiveModule');
  });

  describe('when sending ETH to the system', function () {
    const amount = ethers.utils.parseEther('24');

    before('record balances', async function () {
      userBalanceBefore = await getProvider().getBalance(await user.getAddress());
      systemBalanceBefore = await getProvider().getBalance(ReceiveModule.address);
    });

    it('decreases the senders balance', async function () {
      assertBn.equal(
        await getProvider().getBalance(await user.getAddress()),
        userBalanceBefore.sub(amount)
      );
    });

    it('increases the systems balance', async function () {
      assertBn.equal(
        await getProvider().getBalance(ReceiveModule.address),
        systemBalanceBefore.add(amount)
      );
    });
  });
});
