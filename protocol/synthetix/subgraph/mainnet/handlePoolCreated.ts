import { PoolCreated } from './generated/CoreProxy/CoreProxy';
import { Pool } from './generated/schema';

export function handlePoolCreated(event: PoolCreated): void {
  const newPool = new Pool(event.params.poolId.toString());
  newPool.owner = event.params.owner;
  newPool.created_at = event.block.timestamp;
  newPool.created_at_block = event.block.number;
  newPool.updated_at = event.block.timestamp;
  newPool.updated_at_block = event.block.number;
  newPool.save();
}
