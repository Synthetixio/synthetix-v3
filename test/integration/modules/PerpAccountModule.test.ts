import { BigNumber, ethers, utils } from 'ethers';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { fastForwardTo } from '@synthetixio/core-utils/utils/hardhat/rpc';
import { wei } from '@synthetixio/wei';
import assert from 'assert';
import { shuffle } from 'lodash';
import forEach from 'mocha-each';
import { PerpCollateral, bootstrap } from '../../bootstrap';
import {
  bn,
  genBootstrap,
  genNumber,
  genListOf,
  genOneOf,
  genTrader,
  genOrder,
  toRoundRobinGenerators,
  genBytes32,
  genAddress,
} from '../../generators';
import {
  mintAndApproveWithTrader,
  commitAndSettle,
  commitOrder,
  depositMargin,
  extendContractAbi,
  fastForwardBySec,
  findEventSafe,
  mintAndApprove,
  ADDRESS0,
  withExplicitEvmMine,
  getSusdCollateral,
  isSusdCollateral,
  SYNTHETIX_USD_MARKET_ID,
  findOrThrow,
  setMarketConfiguration,
  SECONDS_ONE_DAY,
  setMarketConfigurationById,
} from '../../helpers';
import { calcPnl } from '../../calculations';
import { assertEvents } from '../../assert';

describe.only('PerpAccountModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, collaterals, collateralsWithoutSusd, spotMarket, traders, owner, systems, provider, restore } = bs;

  beforeEach(restore);

  describe('getAccountDigest', async () => {
    it('should revert when accountId does not exist');

    it('should revert when marketId does not exist');

    it('should not revert when accountId/marketId exists but no positions are open');
  });

  describe('getPositionDigest', () => {
    it('should revert when accountId does not exist');

    it('should revert when marketId does not exist');

    it('should return default object when accountId/marketId exists but no position');

    describe('accruedFunding', () => {
      it('should accrue funding when position is opposite of skew');

      it('should pay funding when position is same side as skew');

      it('should accrue or pay funding when size is 0');
    });

    describe('{im,mm}', () => {});
  });
});
