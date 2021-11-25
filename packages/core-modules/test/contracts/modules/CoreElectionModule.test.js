const { ok } = require('assert/strict');
const assertBn = require('@synthetixio/core-js/utils/assert-bignumber');
const assertRevert = require('@synthetixio/core-js/utils/assert-revert');
const { bootstrap } = require('@synthetixio/deployer/utils/tests');
const initializer = require('../../helpers/initializer');

const { ethers } = hre;

describe('CoreElectionModule', () => {
  const { proxyAddress } = bootstrap(initializer);

  let CoreElectionModule;
  let owner;

  before('identify signers', async () => {
    [owner] = await ethers.getSigners();
  });

  before('identify modules', async () => {
    CoreElectionModule = await ethers.getContractAt('CoreElectionModule', proxyAddress());
  });
});
