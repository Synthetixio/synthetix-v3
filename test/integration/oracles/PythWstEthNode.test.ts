import assert from 'assert';
import assertBn from '@synthetixio/core-utils/utils/assertions/assert-bignumber';
import assertEvent from '@synthetixio/core-utils/utils/assertions/assert-event';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import Wei, { wei } from '@synthetixio/wei';
import { BigNumber, Signer, ethers, utils } from 'ethers';
import forEach from 'mocha-each';
import { bootstrap } from '../../bootstrap';
import { genBootstrap } from '../../generators';
import { assertEvents } from '../../assert';

describe.only('PythWstEthNode', () => {
  const bs = bootstrap(genBootstrap());
  const { systems, extras, restore } = bs;

  beforeEach(restore);

  describe('process', () => {
    it('should compute zero price when no prices available', async () => {
      const { OracleManager } = systems();
      const { pythWstEthNodeId } = extras();
      const { price } = await OracleManager.process(pythWstEthNodeId);
      assertBn.isZero(price);
    });

    it.skip('should compute an accurate wstETH price', async () => {
      const { PerpMarketProxy, OracleManager } = systems();
      const { pythWstEthNodeId } = extras();

      console.log(pythWstEthNodeId);
      // console.log(utils.parseBytes32String(pythWstEthNodeId));

      console.log(await OracleManager.getNode(pythWstEthNodeId));
      console.log(await OracleManager.process(pythWstEthNodeId));
    });

    it('should be zero if the Pyth price is zero');

    it('should revert if no Pyth price has been provided');
  });
});
