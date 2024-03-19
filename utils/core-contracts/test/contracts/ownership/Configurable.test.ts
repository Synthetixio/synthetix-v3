import assert from 'node:assert/strict';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-utils/utils/ethers/events';
import { ethers } from 'ethers';
import hre from 'hardhat';
import { Ownable, Configurable } from '../../../typechain-types';

describe('Ownable', function () {
  let Ownable: Ownable;
  let Configurable: Configurable;

  let owner: ethers.Signer;
  let newOwner: ethers.Signer;
  let configurer: ethers.Signer;
  let newConfigurer: ethers.Signer;
  let user: ethers.Signer;

  before('identify signers', async function () {
    [owner, newOwner, configurer, newConfigurer, user] = await hre.ethers.getSigners();
  });

  before('deploy the contract', async function () {
    const factoryOwnable = await hre.ethers.getContractFactory('Ownable');
    Ownable = await factoryOwnable.deploy(await owner.getAddress());
    const factoryConfigurable = await hre.ethers.getContractFactory('Configurable');
    Configurable = await factoryConfigurable.deploy();
  });

  describe('before a configurer is set', function () {
    it('shows that the  configurer is 0x0', async function () {
      assert.equal(await Configurable.configurer(), '0x0000000000000000000000000000000000000000');
    });

    it('shows that no new configurer is nominated', async function () {
      assert.equal(
        await Configurable.nominatedConfigurer(),
        '0x0000000000000000000000000000000000000000'
      );
    });
  });
});
