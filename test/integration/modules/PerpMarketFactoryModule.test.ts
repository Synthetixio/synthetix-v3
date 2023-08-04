import assert from 'assert';
import assertRevert from '@synthetixio/core-utils/utils/assertions/assert-revert';
import { bootstrap } from '../../bootstrap';
import { genAddress, genBootstrap, genBytes32 } from '../../generators';

describe('PerpMarketFactoryModule', () => {
  const bs = bootstrap(genBootstrap());
  const { traders, owner, systems, restore } = bs;

  beforeEach(restore);

  describe('setSynthetix', () => {
    it('should revert when invalid synthetix addr (due to needing USD token)', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const address = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setSynthetix(address),
        'Error: transaction reverted in contract unknown'
      );
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const address = genAddress();
      await assertRevert(
        PerpMarketProxy.connect(from).setSynthetix(address),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });

  describe('setPyth', () => {
    it('should set successfully', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const address = genAddress();
      await PerpMarketProxy.connect(from).setPyth(address);
      const config = await PerpMarketProxy.getMarketConfiguration();

      assert(config.pyth, address);
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const address = genAddress();
      await assertRevert(PerpMarketProxy.connect(from).setPyth(address), `Unauthorized("${await from.getAddress()}")`);
    });
  });

  describe('setEthOracleNodeId', () => {
    it('should set successfully', async () => {
      const { PerpMarketProxy } = systems();
      const from = owner();

      const nodeId = genBytes32();
      await PerpMarketProxy.connect(from).setEthOracleNodeId(nodeId);
      const config = await PerpMarketProxy.getMarketConfiguration();

      assert(config.ethOracleNodeId, nodeId);
    });

    it('should revert when not owner', async () => {
      const { PerpMarketProxy } = systems();
      const from = traders()[0].signer;
      const nodeId = genBytes32();
      await assertRevert(
        PerpMarketProxy.connect(from).setEthOracleNodeId(nodeId),
        `Unauthorized("${await from.getAddress()}")`
      );
    });
  });
});
