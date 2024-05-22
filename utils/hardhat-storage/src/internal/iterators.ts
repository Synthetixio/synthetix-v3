import {
  AssemblyAssignment,
  ContractDefinition,
  FunctionDefinition,
  SourceUnit,
} from '@solidity-parser/parser/src/ast-types';
import { StorageArtifact } from '../types';
import { findAll, findOne } from './finders';

export function* iterateContracts(
  artifacts: StorageArtifact[]
): Generator<[StorageArtifact, ContractDefinition]> {
  for (const artifact of artifacts) {
    for (const contractNode of findAll(artifact.ast, 'ContractDefinition')) {
      yield [artifact, contractNode];
    }
  }
}

export function* iterateSlotAssignments(
  artifacts: StorageArtifact[]
): Generator<[StorageArtifact, ContractDefinition, FunctionDefinition, AssemblyAssignment]> {
  for (const [artifact, contractNode] of iterateContracts(artifacts)) {
    for (const functionNode of findAll(contractNode, 'FunctionDefinition', _isPureInternal)) {
      const assignments = findAll(functionNode, 'AssemblyAssignment', (node) => {
        return (
          node.names[0].type === 'AssemblyMemberAccess' && node.names[0].memberName.name === 'slot'
        );
      });

      if (!assignments.length) continue;
      if (assignments.length > 1) {
        throw new Error('Cannon have a function that assigns slots several times');
      }

      yield [artifact, contractNode, functionNode, assignments[0]];
    }
  }
}

function _isPureInternal(node: FunctionDefinition) {
  return node.stateMutability === 'pure' && node.visibility === 'internal';
}
