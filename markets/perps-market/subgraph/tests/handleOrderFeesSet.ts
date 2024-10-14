import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handleOrderFeesSet } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createOrderFeesSetEvent } from './event-factories/createOrderFeesSetEvent';

export default function test(): void {
  assert.entityCount('Market', 0);

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

  assert.entityCount('Market', 1);

  log.info('Should update Market with new maker/taker fees', []);

  const makerFeeRatio = 10;
  const takerFeeRatio = 20;

  handleOrderFeesSet(
    createOrderFeesSetEvent(
      perpsMarketId,
      makerFeeRatio,
      takerFeeRatio,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  assert.entityCount('Market', 1);
  assert.fieldEquals('Market', perpsMarketId.toString(), 'makerFee', makerFeeRatio.toString());
  assert.fieldEquals('Market', perpsMarketId.toString(), 'takerFee', takerFeeRatio.toString());
}
