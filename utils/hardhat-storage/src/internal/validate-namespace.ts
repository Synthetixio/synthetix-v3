import { findOne } from '@synthetixio/core-utils/utils/ast/finders';
import { Node, YulNode } from 'solidity-ast/node';
import {
  FunctionCall,
  FunctionDefinition,
  SourceUnit,
  VariableDeclaration,
} from 'solidity-ast/types';
import { createError } from './error';
import { iterateSlotAssignments } from './iterators';
import { isPresent } from './misc';

interface Params {
  /** fully qualified names of the contracts to validate */
  artifacts: string[];
  /** all source units, including the ones in artifacts and all the imported ones */
  sourceUnits: SourceUnit[];
}

export function validateSlotNamespaceCollisions({ sourceUnits }: Params) {
  const slots: string[] = [];

  return [...iterateSlotAssignments(sourceUnits)]
    .map(([sourceUnit, contractNode, functionNode, yulAssignment]) => {
      const _error = (message: string, ...nodes: (Node | YulNode)[]) => ({
        message,
        sourceUnit,
        nodes: [contractNode, functionNode, ...nodes],
      });

      const val = yulAssignment.value;

      // The assignment of the .slot value should be an existing variable
      if (val.nodeType !== 'YulIdentifier') {
        return _error(
          'Store assignments can only be assignments to a constant value in the contract',
          yulAssignment
        );
      }

      // Find when the value is declared inside the current function
      const varStatement = _findVariableDeclarationStatementOf(functionNode, val.name);

      if (!varStatement) {
        return _error(`Could not find variable declaration value for "${val.name}"`, val);
      }

      if (!varStatement.initialValue) {
        return _error('Slot value not initialized', varStatement);
      }

      let slotValue: FunctionCall;

      // If the slot value is a function call, is a dynamic value initialized inside
      // the function
      if (varStatement.initialValue.nodeType === 'FunctionCall') {
        slotValue = varStatement.initialValue;
        // If it is an identifier, it should be pointing to a contract constant
      } else if (varStatement.initialValue.nodeType === 'Identifier') {
        const slotName = varStatement.initialValue.name;

        const constantDeclaration = contractNode.nodes.find(
          (node) =>
            node.nodeType === 'VariableDeclaration' && node.constant && node.name === slotName
        ) as VariableDeclaration | undefined;

        if (!constantDeclaration?.value || constantDeclaration.value.nodeType !== 'FunctionCall') {
          return _error(
            'Slot value should be a contract constant with a value initialized',
            varStatement
          );
        }

        slotValue = constantDeclaration.value;
      } else {
        return _error(
          'Slot value should be a contract constant or a dynamic local value',
          varStatement
        );
      }

      // Get the first string key value from keccak256(abi.encode("slot-name", ...))
      const slotKey = _getSlotValueFromFunctionCall(slotValue);

      if (!slotKey) {
        return _error(
          'Store slot definition should have the format keccak256(abi.encode("your-slot-name", ...))',
          val
        );
      }

      if (slots.includes(slotKey)) {
        return _error(`Store slot name repeated: ${slotKey}`, val);
      }

      slots.push(slotKey);
    })
    .filter(isPresent)
    .map((err) => createError(err));
}

function _findVariableDeclarationStatementOf(functionNode: FunctionDefinition, varName: string) {
  return findOne(functionNode, 'VariableDeclarationStatement', (declarationStatement) => {
    return !!findOne(declarationStatement, 'VariableDeclaration', ({ name }) => name === varName);
  });
}

function _getSlotValueFromFunctionCall(slotValue: FunctionCall) {
  if (slotValue.nodeType !== 'FunctionCall') return;
  if (slotValue.typeDescriptions.typeString !== 'bytes32') return;

  const { expression } = slotValue;
  if (expression.nodeType !== 'Identifier' || expression.name !== 'keccak256') return;
  if (slotValue.arguments.length !== 1 || slotValue.arguments[0].nodeType !== 'FunctionCall')
    return;

  const encode = slotValue.arguments[0];
  if (encode.expression.nodeType !== 'MemberAccess' || encode.expression.memberName !== 'encode')
    return;

  if (encode.arguments.length === 0) return;
  const [slotKey] = encode.arguments;
  if (slotKey.nodeType !== 'Literal' || slotKey.kind !== 'string') return;
  if (typeof slotKey.value !== 'string' || !slotKey.value) return;

  return slotKey.value;
}
