import { bootstrap } from '../../bootstrap';
import { genBootstrap } from '../../generators';

describe('OrderModule', () => {
  const { markets, collaterals, traders, owner, systems, restore } = bootstrap(genBootstrap());

  beforeEach(restore);

  describe('commitOrder', () => {
    it('should successfully commit order with no existing position');
    it('should successfully commit order that completely closes existing position');
    it('should successfully commit order that partially closes existing');
    it('should successfully commit order that adds to an existing order');
    it('should successfully commit order that flips from one side to the other');

    it('should recopmute funding on commitment');

    it('should revert when there is insufficient margin');
    it('should revert when an order already present');
    it('should revert when this order exceeds maxMarketSize (oi)');
    it('should revert when sizeDelta is 0');
    it('should revert when the resulting position can be liquidated');
    it('should revert when max leverage is exceeded');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
  });
});
