import { Address, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction } from 'matchstick-as/assembly/index';

export function mockERC20Name(address: Address, name: string): void {
  createMockedFunction(address, 'name', 'name():(string)').returns([
    ethereum.Value.fromString(name),
  ]);
}

export function mockERC20Symbol(address: Address, symbol: string): void {
  createMockedFunction(address, 'symbol', 'symbol():(string)').returns([
    ethereum.Value.fromString(symbol),
  ]);
}

export function mockERC20Decimals(address: Address, decimals: i32): void {
  createMockedFunction(address, 'decimals', 'decimals():(uint8)').returns([
    ethereum.Value.fromI32(decimals),
  ]);
}
