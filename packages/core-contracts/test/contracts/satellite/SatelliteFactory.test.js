const { ethers } = hre;
const assert = require('assert/strict');

describe('SatelliteFactory', () => {
  let SatelliteFactory;

  const FIRST = ethers.utils.formatBytes32String('first');
  const SECOND = ethers.utils.formatBytes32String('second');
  const ERC20 = ethers.utils.formatBytes32String('ERC20');

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SatelliteFactoryMock');
    SatelliteFactory = await factory.deploy();
  });

  describe('when creating a mocked satellite', () => {
    before('create sattelites', async () => {
      await (await SatelliteFactory.createSatelliteMock(FIRST)).wait();
      await (await SatelliteFactory.createSatelliteMock(SECOND)).wait();
    });

    it('gets newly created satellites', async () => {
      const result = await SatelliteFactory.getSatellites();

      assert.equal(result.length, 2);
      assert.equal(result[0].name, FIRST);
      assert.equal(result[0].contractName, ERC20);
      assert.notEqual(result[0].deployedAddress, '0x0000000000000000000000000000000000000000');

      assert.equal(result.length, 2);
      assert.equal(result[1].name, SECOND);
      assert.equal(result[1].contractName, ERC20);
      assert.notEqual(result[1].deployedAddress, '0x0000000000000000000000000000000000000000');
    });
  });
});
