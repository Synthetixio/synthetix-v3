import { coreBootstrap } from '@synthetixio/router/utils/tests';
import { bootstrap } from '@synthetixio/main/test/integration/bootstrap';
import { wei } from '@synthetixio/wei';
import { ethers } from 'ethers';
import { BuybackSnx } from '../../typechain-types';
import { createOracleNode } from '@synthetixio/oracle-manager/test/common';

interface Contracts {
  BuybackSnx: BuybackSnx;
}
const r = coreBootstrap<Contracts>();

export function bootstrapBuyback() {
  const r = bootstrap();

  let oracleNodeId: string;
  let owner: ethers.Signer;
  let user: ethers.Signer;

  before('get signers', async function () {
    [owner, user] = r.signers();
  });

  before('deploy mock oracle node', async () => {
    const results = await createOracleNode(owner, bn(10), r.systems().OracleManager);
    oracleNodeId = results.oracleNodeId;
  });

  return {
    ...r,
    owner: () => owner,
    user: () => user,
    oracleNodeId: () => oracleNodeId,
  };
}

export const bn = (n: number) => wei(n).toBN();
