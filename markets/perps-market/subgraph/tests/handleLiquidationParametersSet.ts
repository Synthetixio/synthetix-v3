import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleLiquidationParametersSet } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createLiquidationParametersSetEvent } from './event-factories/createLiquidationParametersSetEvent';

export default function test(): void {
  assert.entityCount('Market', 0);

  const marketId = 1;
  const marketName = 'Test Market';
  const marketSymbol = 'TM';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  handleMarketCreated(
    createMarketCreatedEvent(marketId, marketName, marketSymbol, timestamp, blockNumber, logIndex)
  );

  assert.entityCount('Market', 1);

  log.info('Should update the market liquidation parameters', []);

  const initialMarginRatioD18 = 10_000;
  const maintenanceMarginRatioD18 = 5_000;
  const minimumInitialMarginRatioD18 = 4_000;
  const minimumPositionMargin = 1_000;
  const liquidationRewardRatioD18 = 3_000;

  handleLiquidationParametersSet(
    createLiquidationParametersSetEvent(
      marketId,
      initialMarginRatioD18,
      maintenanceMarginRatioD18,
      minimumInitialMarginRatioD18,
      liquidationRewardRatioD18,
      minimumPositionMargin,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.fieldEquals('Market', marketId.toString(), 'id', marketId.toString());
  assert.fieldEquals(
    'Market',
    marketId.toString(),
    'initialMarginRatioD18',
    initialMarginRatioD18.toString()
  );
  assert.fieldEquals(
    'Market',
    marketId.toString(),
    'maintenanceMarginRatioD18',
    maintenanceMarginRatioD18.toString()
  );
  assert.fieldEquals(
    'Market',
    marketId.toString(),
    'liquidationRewardRatioD18',
    liquidationRewardRatioD18.toString()
  );
  assert.fieldEquals(
    'Market',
    marketId.toString(),
    'minimumPositionMargin',
    minimumPositionMargin.toString()
  );
}
