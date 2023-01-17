import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { ethers } from 'ethers';
import { bootstrap } from '../../bootstrap';
import { SampleOwnedModule } from '../../../typechain-types';

describe('ETH transfer', function () {
  const { getContractBehindProxy, getSigners } = bootstrap({
    implementation: 'SampleRouter',
  });

  let owner: ethers.Signer;
  let System: SampleOwnedModule; // Use any module.
  let Router: ethers.Contract;

  const value = ethers.utils.parseEther('1');
  const UnknownSelectorABI = `[{
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "sel",
        "type": "bytes4"
      }
    ],
    "name": "UnknownSelector",
    "type": "error"
  }]`;

  before('identify signers', function () {
    [owner] = getSigners();
  });

  before('identify contracts', function () {
    System = getContractBehindProxy('SampleOwnedModule'); // Just use any module.

    // Now, lock on to a "Router" contract with any address,
    // just to be able to decode the UnknownSelector error type with assertRevert.
    Router = new ethers.Contract(System.address, UnknownSelectorABI, System.provider);
  });

  describe('when sending plain ETH to the contract', async function () {
    it('reverts', async function () {
      await assertRevert(
        owner.sendTransaction({
          to: System.address,
          value,
          gasLimit: 12000000, // Avoid gas estimation in coverage, in order to identify custom error in assert-revert
        }),
        'UnknownSelector("0x00000000")',
        Router
      );
    });
  });

  describe('when interacting with the system without ETH value', async function () {
    it('does not revert', async function () {
      await System.setProtectedValue(42);
    });
  });

  describe('when interacting with the system with ETH value', function () {
    it('does not revert', async function () {
      await System.setProtectedValue(1337, { from: await owner.getAddress(), value });
    });
  });
});
