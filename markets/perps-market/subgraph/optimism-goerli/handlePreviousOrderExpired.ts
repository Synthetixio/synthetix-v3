import { PreviousOrderExpired as PreviousOrderExpiredEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { PreviousOrderExpired } from './generated/schema';

export function handlePreviousOrderExpired(event: PreviousOrderExpiredEvent): void {
  const orderExpiredId =
    event.params.marketId.toString() +
    '-' +
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString();

  // create OrderSettled entity
  let orderExpired = new PreviousOrderExpired(orderExpiredId);
  orderExpired.timestamp = event.block.timestamp;

  orderExpired.marketId = event.params.marketId;
  orderExpired.accountId = event.params.accountId;
  orderExpired.sizeDelta = event.params.sizeDelta;
  orderExpired.acceptablePrice = event.params.acceptablePrice;
  orderExpired.settlementTime = event.params.settlementTime;
  orderExpired.trackingCode = event.params.trackingCode;

  orderExpired.save();
}
