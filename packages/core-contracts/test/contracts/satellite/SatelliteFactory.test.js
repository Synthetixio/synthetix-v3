const { ethers } = hre;
const assert = require('assert/strict');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');

describe('SatelliteFactory', () => {
  let SatelliteFactory;

  before('deploy the contract', async () => {
    const factory = await ethers.getContractFactory('SatelliteFactoryMock');
    SatelliteFactory = await factory.deploy();
  });

  describe('when creating a mocked satellite', () => {
    let receipt;

    before('prepare sattelite', async () => {
      const tx = await SatelliteFactory.createSatelliteMock();
      receipt = await tx.wait();
    });

    it('emits SatelliteCreated event', async () => {
      const event = findEvent({ receipt, eventName: 'SatelliteCreated' });
      assert.equal(event.args.fullyQualifiedName, 'contracts/token/ERC20.sol:ERC20');
      assert.notEqual(event.args.deployedAddress, '0x0000000000000000000000000000000000000000');
    });
  });
});
