const { ethers } = hre;
const assert = require('assert');

describe('BeaconProxy', () => {
  let Beacon, BeaconProxy, Implementation;

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  describe('when a Beacon and a BeaconProxy are deployed', () => {
    before('deploy', async () => {
      let factory;

      factory = await ethers.getContractFactory('ImplementationMockA');
      Implementation = await factory.deploy();

      factory = await ethers.getContractFactory('BeaconMock');
      Beacon = await factory.deploy(owner.address, Implementation.address);

      factory = await ethers.getContractFactory('BeaconProxyMock');
      BeaconProxy = await factory.deploy(Beacon.address);
    });

    it('shows that the Beacon is set correctly', async () => {
      assert.equal(await BeaconProxy.getBeacon(), Beacon.address);
    });

    it('returns the correct implementation', async () => {
      assert.equal(await BeaconProxy.getImplementation(), Implementation.address);
    });
  });
});
