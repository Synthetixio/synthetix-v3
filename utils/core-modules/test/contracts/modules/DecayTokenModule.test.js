const { ethers } = hre;
const assert = require('assert/strict');
const { default: assertRevert } = require('@synthetixio/core-utils/utils/assertions/assert-revert');
const assertBn = require('@synthetixio/core-utils/utils/assertions/assert-bignumber');
const { bootstrap } = require('../../helpers/bootstrap.js');
const initializer = require('@synthetixio/core-modules/test/helpers/initializer');

describe.only('DecayTokenModule', () => {
  const { proxyAddress } = bootstrap(initializer, {
    modules: ['OwnerModule', 'UpgradeModule', 'DecayTokenModule'],
  });

  let TokenModule;

  let user1, user2;

  before('identify signers', async () => {
    [user1, user2] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    TokenModule = await ethers.getContractAt('TokenModule', proxyAddress());
  });

  before('set interest rate', async () => {
    //1% decay per year
    const tx = await TokenModule.setInterestRate(1);
    await tx.wait();
  });

  describe('When attempting to initialize it again', () => {
    it('reverts', async () => {
      await assertRevert(
        TokenModule.initialize('Synthetix Network Token Updated', 'snx', 18),
        'AlreadyInitialized()'
      );
    });
  });

  describe('Before minting any tokens', () => {
    it('the total supply is 0', async () => {
      assertBn.equal(await TokenModule.totalSupply(), 0);
    });

    it('the constructor arguments are set correctly', async () => {
      assert.equal(await TokenModule.name(), 'Synthetix Network Token');
      assert.equal(await TokenModule.symbol(), 'snx');
      assertBn.equal(await TokenModule.decimals(), 18);
      assertBn.equal(await TokenModule.interestRate(), 1);
    });
  });
});
