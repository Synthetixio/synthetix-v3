import { renderRouter } from './internal/render-router';
import { DeployedContractData } from './types';
import debug from 'debug';

interface Params {
  contractName?: string;
  template?: string;
  contracts: DeployedContractData[];
}

export async function generateRouter({
  contractName = 'Router',
  template = undefined,
  contracts = [],
}: Params) {
  for (const c of contracts) debug(`${c.contractName}: ${c.deployedAddress}`);

  const sourceCode = renderRouter({
    routerName: contractName,
    template,
    contracts,
  });

  return sourceCode;
}
