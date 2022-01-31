const assertBn = require('@synthetixio/core-js/utils/assertions/assert-bignumber');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');

describe('nested-structures', function () {
  let hre, proxyAddress;

  before('set fixture project', function () {
    hre = loadEnvironment('nested-structures  ');
  });

  before('prepare environment', async function () {
    this.timeout(60000);

    const { proxyAddress: _proxyAddress } = await deployOnEnvironment(hre, {
      alias: 'first',
      clear: true,
    });

    proxyAddress = _proxyAddress;
  });

  describe('when sharing nested structures on global storage', function () {
    let SomeModule, AnotherModule;

    before('identify modules', async () => {
      SomeModule = await hre.ethers.getContractAt('SomeModule', proxyAddress());
      AnotherModule = await hre.ethers.getContractAt('AnotherModule', proxyAddress());
    });

    it('sets and gets values', async function () {
      await SomeModule.setValue(11);
      await SomeModule.setNestedValue(1, 22);

      assertBn.eq(await AnotherModule.getValue(), 11);
      assertBn.eq(await AnotherModule.getNestedValue(1), 22);
    });
  });
});
