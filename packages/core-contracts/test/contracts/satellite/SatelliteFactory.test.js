const { ethers } = hre;
const assert = require('assert/strict');

describe('SatelliteFactory', () => {
  let SatelliteFactory;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SatelliteFactoryMock');
    SatelliteFactory = await factory.deploy();
  });

  describe('when creating a mocked satellite', () => {
    before('prepare sattelite', async () => {
      const tx = await SatelliteFactory.createSatelliteMock('TestSatellite');
      await tx.wait();
    });

    it('gets newly created satellite', async () => {
      const result = await SatelliteFactory.getSatellites();

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'TestSatellite');
      assert.equal(result[0].contractName, 'ERC20');
      assert.notEqual(result[0].deployedAddress, '0x0000000000000000000000000000000000000000');
    });
  });
});
