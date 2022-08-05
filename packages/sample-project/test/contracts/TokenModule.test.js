const assert = require('assert/strict');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

const { ethers } = hre;

describe('TokenModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let TokenModule;

  before('identify modules', async () => {
    TokenModule = await ethers.getContractAt('TokenModule', proxyAddress());
  });

  describe('when a new token is created', () => {
    const Token = ethers.utils.formatBytes32String('Token');
    const SNXToken = ethers.utils.formatBytes32String('SNXToken');

    before('create the token', async () => {
      const tx = await TokenModule.createSampleToken(SNXToken);
      await tx.wait();
    });

    it('gets newly created token', async () => {
      const result = await TokenModule.getTokenModuleSatellites();

      assert.equal(result.length, 1);
      assert.equal(result[0].name, SNXToken);
      assert.equal(result[0].contractName, Token);
      assert.notEqual(result[0].deployedAddress, '0x0000000000000000000000000000000000000000');
    });
  });
});
