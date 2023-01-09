import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { ethers } from 'ethers';
import { ReceiveModule } from '../../../typechain-types';
import { bootstrap } from '../../bootstrap';

describe.only('ReceiveModule', function () {
  const { getContractBehindProxy, getSigners, getProvider } = bootstrap({
    implementation: 'ReceiveModuleRouter',
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

  before('record balances', async function () {
    userBalanceBefore = await getProvider().getBalance(await user.getAddress());
    systemBalanceBefore = await getProvider().getBalance(ReceiveModule.address);
  });

  describe('when sending ETH to the system', function () {
    const value = ethers.utils.parseEther('24');

    before('send eth', async function () {
      await (await user.sendTransaction({ value, to: ReceiveModule.address })).wait();
    });

    it('decreases the senders balance', async function () {
      assertBn.equal(
        await getProvider().getBalance(await user.getAddress()),
        userBalanceBefore.sub(value)
      );
    });

    it('increases the systems balance', async function () {
      assertBn.equal(
        await getProvider().getBalance(ReceiveModule.address),
        systemBalanceBefore.add(value)
      );
    });
  });
});
