import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleMaxLiquidationParametersSet } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createMaxLiquidationParametersSetEvent } from './event-factories/createMaxLiquidationParametersSetEvent';

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

  log.info('Should update the market with max liquidation parameters', []);

  const maxLiquidationLimitAccumulationMultiplier = 10_000;
  const maxSecondsInLiquidationWindow = 10_000_000;
  const maxLiquidationPd = 10_000_000;
  const endorsedLiquidator = '0x4200000000000000000000000000000000000000';

  //assuming that a handler function to create a Market instance (not provided as part of the problem) has been called

  handleMaxLiquidationParametersSet(
    createMaxLiquidationParametersSetEvent(
      marketId,
      maxLiquidationLimitAccumulationMultiplier,
      maxSecondsInLiquidationWindow,
      maxLiquidationPd,
      endorsedLiquidator,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1); // Assuming Market instance exists
  assert.fieldEquals('Market', marketId.toString(), 'id', marketId.toString());
  assert.fieldEquals(
    'Market',
    marketId.toString(),
    'maxLiquidationLimitAccumulationMultiplier',
    maxLiquidationLimitAccumulationMultiplier.toString()
  );
  assert.fieldEquals(
    'Market',
    marketId.toString(),
    'maxSecondsInLiquidationWindow',
    maxSecondsInLiquidationWindow.toString()
  );
}
