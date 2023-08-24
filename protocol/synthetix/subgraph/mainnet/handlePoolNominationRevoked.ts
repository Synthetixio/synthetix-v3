import { PoolNominationRevoked } from './generated/CoreProxy/CoreProxy';
import { Pool } from './generated/schema';
import { Bytes } from '@graphprotocol/graph-ts';

export function handlePoolNominationRevoked(event: PoolNominationRevoked): void {
  const pool = Pool.load(event.params.poolId.toString());
  if (pool !== null) {
    pool.nominated_owner = Bytes.empty();
    pool.updated_at = event.block.timestamp;
    pool.updated_at_block = event.block.number;
    pool.save();
  }
}
