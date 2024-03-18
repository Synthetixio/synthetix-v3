import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { random } from 'lodash';
import { bootstrap } from '../bootstrap';

export const bn = (n: number) => wei(n).toBN();
export const genNumber = (min = 0, max = 1) => random(min, max);

describe('LidoWstEthToStEthRatioOracle', () => {
  const { systems, extras } = bootstrap();

  describe('process', () => {
    const configureOracleNodes = async (options?: {
      desiredStEthPrice?: number;
      desiredStEthToWstEth?: number;
    }) => {
      const { WstETHMock, StEthToEthMock } = systems();

      const stEthPrice = bn(options?.desiredStEthPrice ?? genNumber(2500, 3000));
      const stEthToWstEth = bn(options?.desiredStEthToWstEth ?? genNumber(1.1, 1.1568));

      await StEthToEthMock.mockSetCurrentPrice(stEthPrice);
      await WstETHMock.mockSetWstEthToStEthRatio(stEthToWstEth);

      return { stEthPrice, stEthToWstEth };
    };

    it('should compute zero price when no prices available', async () => {
      const { OracleManager } = systems();
      const { chainlinkWstEthNodeId } = extras();
      const { price } = await OracleManager.process(chainlinkWstEthNodeId);
      assertBn.isZero(price);
    });

    it('should compute a wstETH price (concrete)', async () => {
      const { OracleManager } = systems();
      const { chainlinkWstEthNodeId } = extras();

      const { stEthPrice, stEthToWstEth } = await configureOracleNodes({
        desiredStEthPrice: 2586,
        desiredStEthToWstEth: 1.153,
      });

      // 2586 * 1.153 = 2981.658 /wstETH
      const { price } = await OracleManager.process(chainlinkWstEthNodeId);
      const expectedPrice = wei(stEthPrice).mul(stEthToWstEth).toBN();

      assertBn.near(price, expectedPrice, bn(0.000001));
    });

    // Same as the compute test above but with random data.
    it('should compute a wstETH price', async () => {
      const { OracleManager } = systems();
      const { chainlinkWstEthNodeId } = extras();

      const { stEthPrice, stEthToWstEth } = await configureOracleNodes({
        desiredStEthPrice: genNumber(1800, 10_000),
      });

      const { price } = await OracleManager.process(chainlinkWstEthNodeId);
      const expectedPrice = wei(stEthPrice).mul(stEthToWstEth).toBN();

      assertBn.near(price, expectedPrice, bn(0.000001));
    });

    it('should be zero if the stETH CL price is zero', async () => {
      const { OracleManager } = systems();
      const { chainlinkWstEthNodeId } = extras();

      await configureOracleNodes({ desiredStEthPrice: 0 });

      const { price } = await OracleManager.process(chainlinkWstEthNodeId);
      assertBn.isZero(price);
    });

    it('should be zero if wstETH<>stETH exchange is zero', async () => {
      const { OracleManager } = systems();
      const { chainlinkWstEthNodeId } = extras();

      await configureOracleNodes({ desiredStEthToWstEth: 0 });

      const { price } = await OracleManager.process(chainlinkWstEthNodeId);
      assertBn.isZero(price);
    });
  });
});
