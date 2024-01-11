import assert from 'assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import Wei, { wei } from '@synthetixio/wei';
import { BigNumber, Signer, ethers, utils } from 'ethers';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { bn, genBootstrap, genOneOf } from '../../generators';
import { assertEvents } from '../../assert';
import { getPythPriceData } from '../../helpers';

describe.only('PythWstEthNode', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, markets, extras, restore } = bs;

  beforeEach(restore);

  describe('process', () => {
    it('should compute zero price when no prices available', async () => {
      const { OracleManager } = systems();
      const { pythWstEthNodeId } = extras();
      const { price } = await OracleManager.process(pythWstEthNodeId);
      assertBn.isZero(price);
    });

    it.only('should compute an accurate wstETH price', async () => {
      const { OracleManager, WstETHMock, StEthToEthMock, PythMock } = systems();
      const { pythWstEthNodeId } = extras();

      const market = genOneOf(markets());

      await WstETHMock.mockSetWstEthToStEthRatio(bn(1.15326952));
      await StEthToEthMock.mockSetCurrentPrice(bn(0.99));

      // Perform a ETH price update (Pyth)
      // Perform a stETH<>wstETH exchange rate update (Lido)
      // Perform a stETH<>ETH exchange rate update (CL)

      // Ensure the math works out correctly e.g.
      //
      // ETH price is 2000
      // stETH<>wstETH is 0.8
      // stETH<>ETH is 0.99
      //
      // Then, 2000 / 0.99 / 0.8 = 2525.25252525 (per wstETH)

      // FIXME: Super crude way to test this with data shared between cannonfile and fixtures.ts
      const ethPrice = 2586;
      const { updateData, updateFee } = await getPythPriceData(
        bs,
        market.marketId(),
        undefined,
        ethPrice,
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'
      );
      await PythMock.updatePriceFeeds([updateData], { value: updateFee });

      const { price } = await OracleManager.process(pythWstEthNodeId);
      const expectedPrice = wei(ethPrice).mul(bn(0.99)).mul(1.15326952).toBN();

      assertBn.near(price, expectedPrice, bn(0.000001));
    });

    it('should be zero if the Pyth price is zero');

    it('should sell collateral on a losing pnl settlement with Pyth PythWstEthNode');

    // Not sure if this can ever occur if Spot market Synth oracle is the same as the Perp wstETH collateral...
    it('should revert on sale of collateral when Pyth oracle price is stale');

    it('should revert if stETH<>wstETH exchange is zero');

    it('should revert if stETH<>ETH exchange rate is zero');
  });
});
