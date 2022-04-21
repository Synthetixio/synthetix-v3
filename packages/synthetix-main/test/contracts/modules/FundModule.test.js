const { ethers } = hre;
const assert = require('assert/strict');
const assertRevert = require('@synthetixio/core-js/utils/assertions/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

describe('FundModule', function () {
  const { proxyAddress } = bootstrap(initializer);

  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  describe('When creating the Fund', async () => {
    let FundModule;
    before('identify modules', async () => {
      FundModule = await ethers.getContractAt('FundModule', proxyAddress());
    });

    describe('When the Module is initialized (Fund is created)', () => {
      before('Initialize (Create a Fund token)', async () => {
        const tx = await FundModule.connect(owner).initializeFundModule();
        await tx.wait();
      });

      it('is initialized', async () => {
        assert.equal(await FundModule.isFundModuleInitialized(), true);
      });

      describe('When attempting to initialize the FundModule twice', () => {
        it('reverts', async () => {
          await assertRevert(
            FundModule.connect(owner).initializeFundModule(),
            'AlreadyInitialized()'
          );
        });
      });
    });
  });
});
