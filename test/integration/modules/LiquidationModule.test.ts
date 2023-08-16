import { bootstrap } from '../../bootstrap';
import { genBootstrap } from '../../generators';

describe('LiquidationModule', () => {
  const bs = bootstrap(genBootstrap());
  const { restore } = bs;

  beforeEach(restore);

  describe('flagPosition', () => {
    it('should flag a position with a health rating <= 1');

    it('should remove any pending orders when present');

    it('should emit all events in correct order');
    it('should recompute funding');

    it('should revert when position already flagged');
    it('should revert when position health rating > 1');
    it('should revert when no open position');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
  });

  describe('liquidatePosition', () => {
    it('should liquidate a flagged position');
    it('should liquidate a flagged position even if health > 1');
    it('should partially liquidate if position hits liq window cap');

    it('should update market size and skew upon liquidation');
    it('should update lastLiq{time,utilization}');
    it('should send liqReward to flagger and keeperFee to liquidator');
    it('should send send both fees to flagger if same keeper');
    it('should remove flagger on full liquidation');
    it('should not remove flagger on partial liquidation');
    it('should remove all position collateral from market on liquidation');

    it('should emit all events in correct order');
    it('should recompute funding');

    it('should revert when liq cap has been met');
    it('should revert when position is not flagged');
    it('should revert when no open position or already liquidated');
    it('should revert when accountId does not exist');
    it('should revert when marketId does not exist');
  });
});
