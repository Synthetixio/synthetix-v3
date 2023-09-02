import { assert, createMockedFunction, log } from 'matchstick-as';
import { handleSettlementStrategyAdded } from '../optimism-mainnet';
import { createSettlementStrategyAddedEvent } from './event-factories/createSettlementStrategyAddedEvent';
import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';

const MOCK_EVENT_ADDRESS = '0xa16081f360e3847006db660bae1c6d1b2e17ec2a';

export default function test(): void {
  assert.entityCount('SettlementStrategy', 0);

  const tupleArray = changetype<ethereum.Value>([
    ethereum.Value.fromI32(1), //strategyType
    ethereum.Value.fromI32(10), //settlementDelay
    ethereum.Value.fromI32(100), //settlementWindowDuration
    ethereum.Value.fromAddress(Address.fromString('0x6900000000000000000000000000000000000000')), //priceVerificationContract
    ethereum.Value.fromBytes(Bytes.fromHexString('0xff')), //feedId
    ethereum.Value.fromString('https://synthetix.io'), //url
    ethereum.Value.fromI32(100500), //settlementReward
    ethereum.Value.fromI32(10), //priceDeviationTolerance
    ethereum.Value.fromI32(50), //minimumUsdExchangeAmount
    ethereum.Value.fromI32(5), //maxRoundingLoss
    ethereum.Value.fromBoolean(false), //disabled
  ]);
  const tuple = changetype<ethereum.Tuple>(tupleArray);
  const tupleValue = ethereum.Value.fromTuple(tuple);

  const synthMarketId = 666;
  const strategyId = 999;

  createMockedFunction(
    Address.fromString(MOCK_EVENT_ADDRESS),
    'getSettlementStrategy',
    `getSettlementStrategy(${[
      'uint128', // marketId,
      'uint256', // strategyId
    ].join(',')}):(tuple(${[
      'uint8', // strategyType
      'uint256', // settlementDelay
      'uint256', // settlementWindowDuration
      'address', // priceVerificationContract
      'bytes32', // feedId
      'string', // url
      'uint256', // settlementReward
      'uint256', // priceDeviationTolerance
      'uint256', // minimumUsdExchangeAmount
      'uint256', // maxRoundingLoss
      'bool', // disabled
    ].join(',')}))`
  )
    .withArgs([
      ethereum.Value.fromI32(synthMarketId), // synthMarketId
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(strategyId)), // strategyId
    ])
    .returns([tupleValue]);

  log.info('Should create a new SettlementStrategy for the event', []);
  handleSettlementStrategyAdded(
    createSettlementStrategyAddedEvent(synthMarketId, strategyId, 10_000, 10, 1)
  );

  // const id1 = '100000000';
  assert.entityCount('SettlementStrategy', 1);
  // assert.fieldEquals('SettlementStrategy', id1, 'id', id1);
  // assert.fieldEquals('SettlementStrategy', id1, 'block', '10');
  // assert.fieldEquals('SettlementStrategy', id1, 'timestamp', '10000');
  // assert.fieldEquals('SettlementStrategy', id1, 'marketId', '1');
  // assert.fieldEquals('SettlementStrategy', id1, 'settlementStrategyId', '100000000');
}
