import { createMockedFunction } from 'matchstick-as';
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { defaultGraphContractAddress } from '../constants';

export function getMarketReportedDebtMock(marketId: i32, reportedDebt: i64): void {
  createMockedFunction(
    Address.fromString(defaultGraphContractAddress),
    'getMarketReportedDebt',
    'getMarketReportedDebt(uint128):(uint256)'
  )
    .withArgs([ethereum.Value.fromUnsignedBigInt(BigInt.fromU64(marketId))])
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromU64(reportedDebt))]);
}
