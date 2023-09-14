import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newTypedMockEvent } from 'matchstick-as';
import { WrapperSet as WrapperSetEvent } from '../../optimism-mainnet/generated/SpotMarketProxy/SpotMarketProxy';

export function createWrapperSetEvent(
  id: i32,
  wrapCollateralType: string,
  maxWrappableAmount: i64,
  timestamp: i64,
  blockNumber: i64
): WrapperSetEvent {
  const event = newTypedMockEvent<WrapperSetEvent>();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam('synthMarketId', ethereum.Value.fromI32(id)));
  event.parameters.push(
    new ethereum.EventParam(
      'wrapCollateralType',
      ethereum.Value.fromAddress(Address.fromString(wrapCollateralType))
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      'maxWrappableAmount',
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(maxWrappableAmount))
    )
  );
  event.block.timestamp = BigInt.fromI64(timestamp);
  event.block.number = BigInt.fromI64(blockNumber);
  return event;
}
