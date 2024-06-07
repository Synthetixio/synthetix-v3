import { CollateralConfigured } from './generated/CoreProxy/CoreProxy';
import { ERC20 } from './generated/CoreProxy/ERC20';
import { CollateralType } from './generated/schema';
import { BigInt, log } from '@graphprotocol/graph-ts';

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

  const erc20Contract = ERC20.bind(event.params.collateralType);

  if (erc20Contract) {
    collateralType.name = erc20Contract.name();
    collateralType.symbol = erc20Contract.symbol();
    collateralType.decimals = BigInt.fromI32(erc20Contract.decimals());
  } else {
    log.error('Token definition not found for collateral type {}', [
      event.params.collateralType.toHex(),
    ]);
  }

  collateralType.save();
}
