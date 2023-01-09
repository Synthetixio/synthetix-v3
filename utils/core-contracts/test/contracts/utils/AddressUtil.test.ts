import assert from 'assert/strict';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { AddressUtilMock } from '../../../typechain-types';

describe('AddressUtil', () => {
  let user: ethers.Signer;
  let AddressUtil: AddressUtilMock;

  before('identify signers', async () => {
    [, user] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async () => {
    const factory = await hre.ethers.getContractFactory('AddressUtilMock');
    AddressUtil = await factory.deploy();
  });

  describe('isContract(address account)', () => {
    it('shows that an EOA is not a contract', async () => {
      assert.equal(await AddressUtil.isContract(await user.getAddress()), false);
    });

    it('shows that itself is a contract', async () => {
      assert.equal(await AddressUtil.isContract(AddressUtil.address), true);
    });
  });
});
