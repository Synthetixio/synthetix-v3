import hre from 'hardhat';
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-js/dist/utils/assertions/assert-bignumber';
import assertRevert from '@synthetixio/core-js/dist/utils/assertions/assert-revert';
import { findEvent } from '@synthetixio/core-js/dist/utils/ethers/events';
import { bootstrap } from '../bootstrap';
import { ethers } from 'ethers';

describe('VaultModule', function () {
  const { signers, systems } = bootstrap();

  let user1: ethers.Signer, user2: ethers.Signer;

  before('identify signers', async () => {
    [, user1, user2] = signers();
  });

  describe('distributeRewards()', () => {
    describe('instantaneous', () => {

    });

    describe('over time', () => {

    });
  });
});
