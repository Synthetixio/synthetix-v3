import { assert, log } from 'matchstick-as';
import { handleMarketCreated, handlePreviousOrderExpired } from '../base-mainnet-andromeda';
import { createMarketCreatedEvent } from './event-factories/createMarketCreatedEvent';
import { createPreviousOrderExpiredEvent } from './event-factories/createPreviousOrderExpiredEvent';

export default function test(): void {
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
  log.info('Should create a new PreviousOrderExpired record', []);

  let marketId = 1;
  let accountId = 1;
  let sizeDelta = 300;
  let acceptablePrice = 400;
  let settlementTime = 500;
  let trackingCode = '0xbebebe';

  handlePreviousOrderExpired(
    createPreviousOrderExpiredEvent(
      marketId,
      accountId,
      sizeDelta,
      acceptablePrice,
      settlementTime,
      trackingCode,
      timestamp,
      blockNumber,
      logIndex
    )
  );

  let orderExpiredId =
    marketId.toString() + '-' + accountId.toString() + '-' + blockNumber.toString();

  assert.fieldEquals('PreviousOrderExpired', orderExpiredId, 'timestamp', timestamp.toString());
  assert.fieldEquals('PreviousOrderExpired', orderExpiredId, 'marketId', marketId.toString());
  assert.fieldEquals('PreviousOrderExpired', orderExpiredId, 'accountId', accountId.toString());
  assert.fieldEquals('PreviousOrderExpired', orderExpiredId, 'sizeDelta', sizeDelta.toString());
  assert.fieldEquals(
    'PreviousOrderExpired',
    orderExpiredId,
    'acceptablePrice',
    acceptablePrice.toString()
  );
  assert.fieldEquals(
    'PreviousOrderExpired',
    orderExpiredId,
    'settlementTime',
    settlementTime.toString()
  );
  assert.fieldEquals('PreviousOrderExpired', orderExpiredId, 'trackingCode', trackingCode);
}
