import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import { wei } from '@synthetixio/wei';
import { bootstrap } from '../bootstrap';

const bn = (n: number) => wei(n).toBN();
const genNumber = (min = 0, max = 1) => Math.random() * (max - min) + min;

describe('ERC4626ToAssetsRatioOracleNode', () => {
  const { systems, extras } = bootstrap();

  describe('process', () => {

    it('should provide the appropriate amount of asset tokens per vault token', async () => {
      const { OracleManager } = systems();
      // const { erc_4626_to_assets_ratio_oracle_node_id: nodeId } = extras();

      // totalSupply of vault is 200 (w/ 6 decimals)
      // asset.balanceOf(vault) is 120 (w/ 6 decimals)
      // it should return 0.6 (w/ 18 decimals)
      const { price } = await OracleManager.process("0x2452589138778bed0323ca3104cdef52d85767ff689a1b914e72df5a4719580f");
      const expectedPrice = wei(0.6).toBN();

      assertBn.near(price, expectedPrice, bn(0.000001));
    });
  });
});