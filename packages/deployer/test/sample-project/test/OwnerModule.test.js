const hre = require('hardhat');
const assert = require('assert');
const { config, ethers } = hre;
const { getProxyAddress } = require('../../../utils/deployments');
const { assertRevert } = require('@synthetixio/core-js/utils/assertions');
const { bootstrap, initializeSystem } = require('./helpers/initializer');

describe('OwnerModule', () => {
  bootstrap();

  let OwnerModule;

  let owner, user;

  before('identify signers', async () => {
    [owner, user] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress();

    OwnerModule = await ethers.getContractAt('OwnerModule', proxyAddress);
  });

  describe('before an owner is set', () => {
    it('shows that no owner is set', async () => {
      assert.equal(
        await OwnerModule.getOwner(),
        '0x0000000000000000000000000000000000000000'
      );
    });
  });

  describe('when an address is nominated', () => {
    before('nominate ownership', async () => {
      const tx = await OwnerModule.connect(owner).nominateOwner(owner.address);
      await tx.wait();
    });

    it('shows that the address is nominated', async () => {
      assert.equal(
        await OwnerModule.getNominatedOwner(),
        owner.address
      );
    });
  });
});
