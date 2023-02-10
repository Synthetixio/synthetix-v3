// import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
// import { ethers } from 'ethers';
// import { snapshotCheckpoint } from '../../utils/snapshot';
// import { bootstrapWithMockMarketAndPool } from '../bootstrap';

describe('CollateralConfiguration', function () {
  // const {
  //   signers,
  // } = bootstrapWithMockMarketAndPool();

  // let owner: ethers.Signer;
  // let user1: ethers.Signer;

  // before('init', async () => {
  //   [owner, user1] = signers();
  // });

  describe('convertTokenToSystemAmount()', async () => {
    it('scales token with 0 decimals to system amount', async () => {});
    it('scales token with 6 decimals system amount', async () => {});
    it('scales token with 18 decimals to system amount', async () => {});
    it('scales token with greater than 18 decimals to system amount', async () => {});
    it('scales token that does not define decimals to system amount', async () => {});
    it('reverts when scaling to system amount results in loss of precision', async () => {});
  });
});
