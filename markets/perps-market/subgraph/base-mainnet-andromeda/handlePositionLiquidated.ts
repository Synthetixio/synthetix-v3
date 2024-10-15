import { PositionLiquidated as PositionLiquidatedEvent } from './generated/PerpsMarketProxy/PerpsMarketProxy';
import { PositionLiquidated } from './generated/schema';

export function handlePositionLiquidated(event: PositionLiquidatedEvent): void {
  const id =
    event.params.marketId.toString() +
    '-' +
    event.params.accountId.toString() +
    '-' +
    event.block.number.toString();

  const positionLiquidated = new PositionLiquidated(id);

  positionLiquidated.accountId = event.params.accountId;
  positionLiquidated.timestamp = event.block.timestamp;
  positionLiquidated.marketId = event.params.marketId;
  positionLiquidated.amountLiquidated = event.params.amountLiquidated;
  positionLiquidated.currentPositionSize = event.params.currentPositionSize;

  positionLiquidated.save();
}
