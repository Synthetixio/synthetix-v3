import {
  findContractDependencies,
  findFunctionNodes,
  findContractNode,
} from '@synthetixio/core-utils/utils/ast/finders';
import { FunctionDefinition, SourceUnit } from 'solidity-ast';

export function validateInterfaces(
  contractsFullyQualifiedNames: string[],
  astNodes: SourceUnit[],
  functionFilter: (fnName: string) => boolean
) {
  return contractsFullyQualifiedNames.flatMap((fqName) => {
    const visible = _findVisibleFunctions(fqName, astNodes, functionFilter);
    const interfaced = _findInterfaceFunctions(fqName, astNodes);

    return visible
      .filter((fn) => !_includesFunction(interfaced, fn))
      .map((fn) => ({
        msg: `Visible function "${fn.name}" of contract "${fqName}" not found in the inherited interfaces`,
      }));
  });
}

function _includesFunction(fns: FunctionDefinition[], fn: FunctionDefinition) {
  return fns.some((f) => f.functionSelector === fn.functionSelector);
}

function _findVisibleFunctions(
  fqName: string,
  astNodes: SourceUnit[],
  functionFilter: (fnName: string) => boolean
) {
  return findFunctionNodes(fqName, astNodes)
    .filter((f) => f.visibility === 'public' || f.visibility === 'external')
    .filter((f) => functionFilter(f.name));
}

function _findInterfaceFunctions(fqName: string, astNodes: SourceUnit[]): FunctionDefinition[] {
  return findContractDependencies(fqName, astNodes)
    .flatMap((depFqName) => {
      const contractNode = findContractNode(depFqName, astNodes);
      if (contractNode!.contractKind != 'interface') return;
      return findFunctionNodes(depFqName, astNodes);
    })
    .filter((def): def is FunctionDefinition => !!def);
}
