import assert from 'assert/strict';
import { bootstrap } from '../../../bootstrap';

describe('AccountModule', function () {
  const { systems } = bootstrap();

  describe('AccountModule - Initialization', function () {
    describe('when the core and account systems are deployed and set up', function () {
      it('sets the account system address in the core system', async function () {
        assert.equal(await systems().Core.getAccountTokenAddress(), systems().Account.address);
      });

      it('sets the core system as the owner of the account system', async function () {
        assert.equal(await systems().Account.owner(), systems().Core.address);
      });

      it('initializes the account system correctly', async function () {
        assert.equal(await systems().Account.name(), 'Synthetix Account');
        assert.equal(await systems().Account.symbol(), 'SACCT');
      });
    });
  });
});
