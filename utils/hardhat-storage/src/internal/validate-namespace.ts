import {
  ASTNode,
  ContractDefinition,
  FunctionDefinition,
  Identifier,
  VariableDeclaration,
} from '@solidity-parser/parser/src/ast-types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { GetArtifactFunction } from '../types';
import { createError } from './error';
import { findOne } from './finders';
import { isPresent } from './is-present';
import { iterateSlotAssignments } from './iterators';

interface Params {
  contracts: string[];
  getArtifact: GetArtifactFunction;
}

export async function validateSlotNamespaceCollisions({ contracts, getArtifact }: Params) {
  const slots: string[] = [];

  const artifacts = await Promise.all(
    contracts.map(async (fqName) => {
      const { sourceName } = parseFullyQualifiedName(fqName);
      return await getArtifact(sourceName);
    })
  );

  return [...iterateSlotAssignments(artifacts)]
    .map(([artifact, contractNode, functionNode, yulAssignment]) => {
      const _error = (message: string, ...nodes: ASTNode[]) => ({
        message,
        sourceName: artifact.sourceName,
        nodes: [contractNode, functionNode, ...nodes],
      });

      const val = yulAssignment.expression;

      // The assignment of the .slot value should be an existing variable
      if (val.type !== 'AssemblyCall') {
        return _error(
          'Store assignments can only be assignments to a constant value in the contract',
          yulAssignment
        );
      }

      // Find the declaration of the value
      const varStatement = _findVariableDeclarationStatementOf(
        contractNode,
        functionNode,
        val.functionName
      );

      if (!varStatement) {
        return _error(`Could not find variable declaration value for "${val.functionName}"`, val);
      }

      if (!varStatement.initialValue) {
        return _error('Slot value not initialized', varStatement);
      }

      const slotValue = findOne(varStatement, 'StringLiteral');

      if (!slotValue) {
        return _error(
          'Store slot definition should have the format keccak256(abi.encode("your-slot-name", ...))',
          val
        );
      }

      const slotKey = slotValue.value;

      if (slots.includes(slotKey)) {
        return _error(`Store slot name repeated: ${slotKey}`, val);
      }

      slots.push(slotKey);
    })
    .filter(isPresent)
    .map((err) => createError(err));
}

function _findVariableDeclarationStatementOf(
  contractNode: ContractDefinition,
  functionNode: FunctionDefinition,
  varName: string
) {
  const res = findOne(functionNode, 'VariableDeclarationStatement', (declarationStatement) => {
    return (
      declarationStatement.variables.length === 1 &&
      declarationStatement.variables[0]?.type === 'VariableDeclaration' &&
      (declarationStatement.variables[0] as VariableDeclaration).name === varName
    );
  });

  if (!res || !res.initialValue) return;

  if (res.initialValue.type === 'Identifier') {
    return findOne(contractNode, 'StateVariableDeclaration', (stateVariable) => {
      return !!findOne(
        stateVariable,
        'VariableDeclaration',
        ({ name }) => name === (res.initialValue as Identifier).name
      );
    });
  }

  return res;
}
