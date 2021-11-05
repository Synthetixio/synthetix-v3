const { ethers } = hre;
const assert = require('assert');

describe('BeaconProxy', () => {
  let Beacon, BeaconProxy, MockedBeaconProxy, Implementation;

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
      Beacon = await factory.deploy(Implementation.address);

      factory = await ethers.getContractFactory('BeaconProxyMock');
      BeaconProxy = await factory.deploy(Beacon.address);

      const ImplementationContract = await hre.artifacts.readArtifact('ImplementationMockA');
      MockedBeaconProxy = new ethers.Contract(
        BeaconProxy.address,
        ImplementationContract.abi,
        owner
      );
    });

    it('shows that the Beacon is set correctly', async () => {
      assert.equal(await BeaconProxy.getBeacon(), Beacon.address);
    });

    it('returns the correct implementation', async () => {
      assert.equal(await BeaconProxy.getImplementation(), Implementation.address);
    });

    describe('when interacting with the implementation via the beaconproxy', async () => {
      describe('when setting and reading a value that exists in the implementation', () => {
        before('set a value and send ETH', async () => {
          await (await MockedBeaconProxy.setA(1337)).wait();
        });

        it('can read the value set', async () => {
          assert.equal(await MockedBeaconProxy.getA(), 1337);
        });
      });
    });
  });
});
