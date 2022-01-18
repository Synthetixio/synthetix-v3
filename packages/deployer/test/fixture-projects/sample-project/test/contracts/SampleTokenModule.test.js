const assert = require('assert/strict');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../helpers/initializer');

const { ethers } = hre;

describe('SampleTokenModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let SampleTokenModule;

  before('identify modules', async () => {
    SampleTokenModule = await ethers.getContractAt('SampleTokenModule', proxyAddress());
  });

  describe('when a new token is created', () => {
    before('create the token', async () => {
      const tx = await SampleTokenModule.createSampleToken('SNXToken');
      await tx.wait();
    });

    it('gets newly created token', async () => {
      const result = await SampleTokenModule.getSampleTokenModuleSatellites();

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'SNXToken');
      assert.equal(result[0].contractName, 'SampleToken');
      assert.notEqual(result[0].deployedAddress, '0x0000000000000000000000000000000000000000');
    });
  });
});
