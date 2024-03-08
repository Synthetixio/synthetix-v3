import { PoolOwnerNominated } from './generated/CoreProxy/CoreProxy';
import { Pool } from './generated/schema';

export function handlePoolOwnerNominated(event: PoolOwnerNominated): void {
  const pool = Pool.load(event.params.poolId.toString());
  if (pool !== null) {
    pool.nominated_owner = event.params.nominatedOwner;
    pool.updated_at = event.block.timestamp;
    pool.updated_at_block = event.block.number;
    pool.save();
  }
}
