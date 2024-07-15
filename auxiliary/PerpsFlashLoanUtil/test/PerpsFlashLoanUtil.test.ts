/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'assert/strict';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';

import { ethers } from 'ethers';
import { bn, bootstrapUtil } from './bootstrap';
import { findSingleEvent } from '@synthetixio/core-utils/utils/ethers/events';

describe('FlashLoanUtil', function () {
  const { getContract, user, owner } = bootstrapUtil();

  let FlashLoanUtil: ethers.Contract;

  before('prepare environment', async () => {});

  before('set up token balances', async () => {});

  describe('initial state is set', function () {});

  describe('flash loan util', function () {});
});
