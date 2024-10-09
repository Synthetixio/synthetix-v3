import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handlePositionLiquidated } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createPositionLiquidatedEvent } from './event-factories/createPositionLiquidatedEvent';

export default function test(): void {
  assert.entityCount('Market', 0);
  assert.entityCount('PositionLiquidated', 0);

  const perpsMarketId = 1;
  const marketName = 'Test Market';
  const marketSymbol = 'TM';
  const timestamp = 10_000;
  const blockNumber = 10;
  const logIndex = 1;

  handleMarketCreated(
    createMarketCreatedEvent(
      perpsMarketId,
      marketName,
      marketSymbol,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  log.info('Should create a new PositionLiquidated record', []);

  let accountId = 1;
  let marketId = 1;
  let amountLiquidated = 500;
  let currentPositionSize = 600;

  handlePositionLiquidated(
    createPositionLiquidatedEvent(
      accountId,
      marketId,
      amountLiquidated,
      currentPositionSize,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.entityCount('PositionLiquidated', 1);

  let positionLiquidatedId =
    marketId.toString() + '-' + accountId.toString() + '-' + blockNumber.toString();

  assert.fieldEquals('PositionLiquidated', positionLiquidatedId, 'timestamp', timestamp.toString());
  assert.fieldEquals('PositionLiquidated', positionLiquidatedId, 'marketId', marketId.toString());
  assert.fieldEquals('PositionLiquidated', positionLiquidatedId, 'accountId', accountId.toString());
  assert.fieldEquals(
    'PositionLiquidated',
    positionLiquidatedId,
    'amountLiquidated',
    amountLiquidated.toString()
  );
  assert.fieldEquals(
    'PositionLiquidated',
    positionLiquidatedId,
    'currentPositionSize',
    currentPositionSize.toString()
  );
}
