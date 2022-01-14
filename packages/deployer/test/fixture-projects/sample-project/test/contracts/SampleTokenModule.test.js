const assert = require('assert/strict');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const { findEvent } = require('@synthetixio/core-js/utils/ethers/events');
const initializer = require('../helpers/initializer');

const { ethers } = hre;

describe('SampleTokenModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let SampleTokenModule;

  before('identify modules', async () => {
    SampleTokenModule = await ethers.getContractAt('SampleTokenModule', proxyAddress());
  });

  describe('when a new token is created', () => {
    let receipt;

    before('create the token', async () => {
      const tx = await SampleTokenModule.createSampleToken();
      receipt = await tx.wait();
    });

    it('emits the SatelliteCreated event', async () => {
      const event = findEvent({ receipt, eventName: 'SatelliteCreated' });
      assert.equal(event.args.fullyQualifiedName, 'contracts/token/SampleToken.sol:SampleToken');
      assert.notEqual(event.args.deployedAddress, '0x0000000000000000000000000000000000000000');
    });
  });
});
