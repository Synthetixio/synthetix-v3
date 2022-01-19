const { ethers } = hre;
const assert = require('assert/strict');

describe('SatelliteFactory', () => {
  describe('when managing a single satellite', () => {
    let SatelliteFactory;

    before('deploy the contract', async () => {
      const factory = await ethers.getContractFactory('SatelliteFactoryMock');
      SatelliteFactory = await factory.deploy();
    });

    describe('when creating a mocked satellite', () => {
      const SAT = ethers.utils.formatBytes32String('sat');

      before('prepare sattelite', async () => {
        const tx = await SatelliteFactory.createSatelliteMock(SAT);
        await tx.wait();
      });

      it('gets newly created satellite', async () => {
        const result = await SatelliteFactory.getSatellite();

        assert.equal(result.id, SAT);
        assert.equal(result.contractName, 'ERC20');
        assert.notEqual(result.deployedAddress, '0x0000000000000000000000000000000000000000');
      });
    });
  });

  describe('when managing multiple satellites', () => {
    let SatellitesFactory;

    const FIRST = ethers.utils.formatBytes32String('fst');
    const SECOND = ethers.utils.formatBytes32String('snd');

    before('deploy the contract', async () => {
      const factory = await ethers.getContractFactory('SatellitesFactoryMock');
      SatellitesFactory = await factory.deploy();
    });

    describe('when creating a mocked satellite', () => {
      before('create sattelites', async () => {
        await (await SatellitesFactory.createSatelliteMock(FIRST)).wait();
        await (await SatellitesFactory.createSatelliteMock(SECOND)).wait();
      });

      it('gets newly created satellite', async () => {
        const result = await SatellitesFactory.getSatellites();

        assert.equal(result.length, 2);
        assert.equal(result[0].id, FIRST);
        assert.equal(result[0].contractName, 'ERC20');
        assert.notEqual(result[0].deployedAddress, '0x0000000000000000000000000000000000000000');

        assert.equal(result.length, 2);
        assert.equal(result[1].id, SECOND);
        assert.equal(result[1].contractName, 'ERC20');
        assert.notEqual(result[1].deployedAddress, '0x0000000000000000000000000000000000000000');
      });
    });
  });
});
