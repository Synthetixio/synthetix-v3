import { CollateralConfigured } from './generated/CoreProxy/CoreProxy';
import { CollateralType } from './generated/schema';
import { BigInt, log } from '@graphprotocol/graph-ts';
import { TokenDefinition } from './collateralDefinition';

export function handleCollateralConfigured(event: CollateralConfigured): void {
  let collateralType = CollateralType.load(event.params.collateralType.toHex());

  if (collateralType === null) {
    collateralType = new CollateralType(event.params.collateralType.toHex());
    collateralType.created_at = event.block.timestamp;
    collateralType.created_at_block = event.block.number;
  }

  collateralType.oracle_node_id = BigInt.fromSignedBytes(event.params.config.oracleNodeId);
  collateralType.liquidation_reward = event.params.config.liquidationRewardD18.toBigDecimal();
  collateralType.liquidation_ratio = event.params.config.liquidationRatioD18.toBigDecimal();
  collateralType.depositing_enabled = event.params.config.depositingEnabled;
  collateralType.issuance_ratio = event.params.config.issuanceRatioD18.toBigDecimal();
  collateralType.min_delegation = event.params.config.minDelegationD18.toBigDecimal();
  collateralType.updated_at = event.block.timestamp;
  collateralType.updated_at_block = event.block.number;

  const tokenDefinition = TokenDefinition.fromAddress(event.params.collateralType);

  if (tokenDefinition !== null) {
    collateralType.name = tokenDefinition.name;
    collateralType.symbol = tokenDefinition.symbol;
    collateralType.decimals = tokenDefinition.decimals;
  } else {
    log.error('Token definition not found for collateral type {}', [
      event.params.collateralType.toHex(),
    ]);
  }

  collateralType.save();
}
