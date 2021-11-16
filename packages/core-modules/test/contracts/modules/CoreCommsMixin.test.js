const hre = require('hardhat');
const assert = require('assert');
const { ethers } = hre;
const { getProxyAddress } = require('@synthetixio/deployer/utils/deployments');
const { printGasUsed } = require('@synthetixio/core-js/utils/tests');
const bootstrap = require('../../helpers/bootstrap');

describe('CoreCommsMixin', () => {
  const { deploymentInfo } = bootstrap();

  let SomeModule, AnotherModule;

  before('identify modules', async () => {
    const proxyAddress = getProxyAddress(deploymentInfo);

    SomeModule = await ethers.getContractAt('SomeModuleMock', proxyAddress);
    AnotherModule = await ethers.getContractAt('AnotherModuleMock', proxyAddress);
  });

  describe('when writting to GlobalNamespace.someValue', () => {
    before('set value if zero for correct gas measurements', async () => {
      const tx = await SomeModule.setSomeValue(1);
      await tx.wait();
    });

    it('directly via SomeModule', async function () {
      const tx = await SomeModule.setSomeValue(42);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(await SomeModule.getSomeValue(), 42);
    });

    it('indirectly via AnotherModule', async function () {
      const tx = await AnotherModule.setSomeValueOnSomeModule(1337);
      const receipt = await tx.wait();

      printGasUsed({ test: this, gasUsed: receipt.cumulativeGasUsed });

      assert.equal(await SomeModule.getSomeValue(), 1337);
    });
  });
});
