import { getContractsAsts } from '@synthetixio/core-utils/utils/hardhat/contracts';
import { subtask } from 'hardhat/config';
import { iterateFunctions } from '../internal/iterators';
import { SUBTASK_STORAGE_GET_SOURCE_UNITS } from '../task-names';

// Flag added by solidity-coverage module, necessary so we can check if it is being used
declare module 'hardhat/types/runtime' {
  export interface HardhatRuntimeEnvironment {
    __SOLIDITY_COVERAGE_RUNNING?: boolean;
  }
}

subtask(SUBTASK_STORAGE_GET_SOURCE_UNITS).setAction(async ({ contracts }, hre) => {
  const sourceUnits = await getContractsAsts(hre, contracts);

  // When running coverage, remove function calls added by solidity-coverage
  if (hre.__SOLIDITY_COVERAGE_RUNNING) {
    for (const [, contractNode, functionNode] of iterateFunctions(sourceUnits)) {
      // Remove function added to the contract
      if (functionNode.name.startsWith('c_')) {
        contractNode.nodes = contractNode.nodes.filter((node) => node !== functionNode);
        continue;
      }

      // Remove the function calls to the previously deleted coverage functions
      if (Array.isArray(functionNode.body?.statements)) {
        functionNode.body!.statements = functionNode.body!.statements.filter((node) => {
          if (node.nodeType !== 'ExpressionStatement') return true;
          const e = node.expression;
          const isCoverage =
            e.nodeType === 'FunctionCall' &&
            e.kind === 'functionCall' &&
            e.expression.nodeType === 'Identifier' &&
            e.expression.name.startsWith('c_');
          return !isCoverage;
        });
      }
    }
  }

  return sourceUnits;
});
