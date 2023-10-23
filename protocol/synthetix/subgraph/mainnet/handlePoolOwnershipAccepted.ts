import { PoolOwnershipAccepted } from './generated/CoreProxy/CoreProxy';
import { Pool } from './generated/schema';
import { Bytes } from '@graphprotocol/graph-ts';

export function handlePoolOwnershipAccepted(event: PoolOwnershipAccepted): void {
  const pool = Pool.load(event.params.poolId.toString());
  if (pool !== null) {
    pool.updated_at_block = event.block.number;
    pool.updated_at = event.block.timestamp;
    pool.owner = event.params.owner;
    pool.nominated_owner = Bytes.empty();
    pool.save();
  }
}
