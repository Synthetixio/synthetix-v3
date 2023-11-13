import { BigInt } from '@graphprotocol/graph-ts';

export function calculateVolume(tradeSize: BigInt, lastPrice: BigInt): BigInt {
  return tradeSize.times(lastPrice).div(BigInt.fromI32(10).pow(18)).abs();
}

export function calculateLeverage(size: BigInt, lastPrice: BigInt, margin: BigInt): BigInt {
  if (size.equals(BigInt.fromI32(0))) return BigInt.fromI32(0);
  return size.times(lastPrice).div(margin).abs();
}

export function calculatePnl(lastPrice: BigInt, avgEntryPrice: BigInt, size: BigInt): BigInt {
  return lastPrice.minus(avgEntryPrice).times(size).div(BigInt.fromI32(10).pow(18));
}

export function calculateAccruedPnlForReducingPositions(
  lastPrice: BigInt,
  avgEntryPrice: BigInt,
  tradeSize: BigInt
): BigInt {
  const tradeSizeFlipped = tradeSize.times(BigInt.fromI32(-1));
  const accruedPnl = lastPrice
    .minus(avgEntryPrice)
    .times(tradeSizeFlipped)
    .div(BigInt.fromI32(10).pow(18));
  return accruedPnl;
}

export function calculateAccruedFunding(
  pastFunding: BigInt,
  currentFunding: BigInt,
  size: BigInt
): BigInt {
  return currentFunding.minus(pastFunding).times(size).div(BigInt.fromI32(10).pow(18));
}
