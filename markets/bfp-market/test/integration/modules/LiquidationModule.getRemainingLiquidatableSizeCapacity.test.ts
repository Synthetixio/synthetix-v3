import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { BigNumber } from 'ethers';
import { times } from 'lodash';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genNumber, genOneOf } from '../../generators';
import { setMarketConfigurationById, setBaseFeePerGas } from '../../helpers';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { markets, systems, provider, restore } = bs;

  beforeEach(restore);

  afterEach(async () => await setBaseFeePerGas(1, provider()));

  describe('getRemainingLiquidatableSizeCapacity', () => {
    const calcMaxLiquidatableCapacity = (
      makerFee: BigNumber,
      takerFee: BigNumber,
      skewScale: BigNumber,
      liquidationLimitScalar: BigNumber
    ) => wei(makerFee.add(takerFee)).mul(skewScale).mul(liquidationLimitScalar).toBN();

    describe('maxLiquidatableCapacity', () => {
      it('should be calculated relative to makerFee/takerFee and skewScale', async () => {
        const { BfpMarketProxy } = systems();
        const market = genOneOf(markets());
        const marketId = market.marketId();

        const liquidationLimitScalar = bn(1);
        const makerFee = bn(0.0001);
        const takerFee = bn(0.0001);
        const skewScale = bn(1_000_000);

        await setMarketConfigurationById(bs, marketId, {
          liquidationLimitScalar,
          makerFee,
          takerFee,
          skewScale,
        });

        const { maxLiquidatableCapacity } =
          await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
        const expectedMaxLiquidatableCapacity = calcMaxLiquidatableCapacity(
          makerFee,
          takerFee,
          skewScale,
          liquidationLimitScalar
        );
        assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);
      });

      /* Randomly test 10 scalars between 0 and 1 (inclusive, always include boundaries). */
      forEach([0, ...times(8).map(() => genNumber(0.1, 0.9)), 1]).it(
        `should scale with liquidationLimitScalar of '%0.5f'`,
        async (scalar: number) => {
          const { BfpMarketProxy } = systems();
          const market = genOneOf(markets());
          const marketId = market.marketId();

          const makerFee = bn(genNumber(0.0001, 0.0005));
          const takerFee = bn(genNumber(0.0006, 0.001));
          const skewScale = bn(1_000_000);

          const liquidationLimitScalar = bn(scalar);
          await setMarketConfigurationById(bs, marketId, {
            liquidationLimitScalar,
            makerFee,
            takerFee,
            skewScale,
          });

          const { maxLiquidatableCapacity } =
            await BfpMarketProxy.getRemainingLiquidatableSizeCapacity(marketId);
          const expectedMaxLiquidatableCapacity = calcMaxLiquidatableCapacity(
            makerFee,
            takerFee,
            skewScale,
            liquidationLimitScalar
          );
          assertBn.equal(maxLiquidatableCapacity, expectedMaxLiquidatableCapacity);
        }
      );
    });

    describe('remainingCapacity', () => {
      it('should be updated to reflect a recent liquidation');

      it(
        'should be zero when cap has been met and an endorsed liquidator pushes past cap for window'
      );
    });
  });
});
