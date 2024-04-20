import { findAll } from '@synthetixio/core-utils/utils/ast/finders';
import { clone } from '@synthetixio/core-utils/utils/misc/clone';
import { SourceUnit, StructDefinition, UserDefinedTypeName } from 'solidity-ast/types';
import { iterateContracts } from './iterators';
import { render } from './render';

/**
 * Generate a single solidity file including all the given contracts but only
 * rendering its storage defintions.
 */
export async function dumpStorage(
  sourceUnits: SourceUnit[],
  version?: string,
  license = 'UNLICENSED'
) {
  if (!Array.isArray(sourceUnits) || !sourceUnits.length) {
    throw new Error('No solidity files found');
  }

  const result = [
    `// SPDX-License-Identifier: ${license}`,
    version ? `pragma solidity ${version};` : _renderPragmaDirective(sourceUnits),
    '',
  ];

  for (const [sourceUnit, contractNode] of iterateContracts(sourceUnits)) {
    const sourceName = sourceUnit.absolutePath;
    const contractName = contractNode.name;
    const fqName = `${sourceName}:${contractName}`;

    const resultNode = clone(contractNode);

    const enumDefinitions = findAll(contractNode, 'EnumDefinition');
    const structDefinitions = findAll(contractNode, 'StructDefinition').map((structDefinition) =>
      _flattenNestedStructDefinitions(sourceUnits, structDefinition)
    );

    // TODO: handle changes on enums
    // TODO: handle contracts references (should they be converted to addresses?)
    // TODO: handle array of custom values
    // TODO: handle mappings of custom values

    // Filter all the contract nodes to only include Structs
    resultNode.nodes = [...enumDefinitions, ...structDefinitions];

    if (!resultNode.nodes.length) continue;

    // Render the contract only including storage definitions
    const contract = render(resultNode);

    result.push(`// @custom:artifact ${fqName}`);
    result.push(contract);
    result.push('');
  }

  return result.join('\n');
}

function _renderPragmaDirective(sourceUnits: SourceUnit[]) {
  const sourceUnit = sourceUnits[sourceUnits.length - 1];
  // TODO: calculate the best solc version based on all the files, instead of using
  // the one from the last file
  for (const node of findAll(sourceUnit, 'PragmaDirective')) return render(node);
}

function _flattenNestedStructDefinitions(
  sourceUnits: SourceUnit[],
  structDefinition: StructDefinition
) {
  const result = clone(structDefinition);

  // Replace type references of the structs to the actual members of the child
  result.members = structDefinition.members
    .map((member) => {
      if (member.nodeType !== 'VariableDeclaration') return member;
      if (member.typeName?.nodeType !== 'UserDefinedTypeName') return member;
      if (!member.typeName.typeDescriptions.typeString?.startsWith('struct ')) return member;

      const child = clone(_findStructDefinitionByReference(sourceUnits, member.typeName));
      const childStruct = _flattenNestedStructDefinitions(sourceUnits, child);

      // Use child struct members
      return childStruct.members.map((variableDeclaration) => {
        // prefix variable name with parent struct name
        variableDeclaration.name = `${member.name}__${variableDeclaration.name}`;
        return variableDeclaration;
      });
    })
    .flat();

  return result;
}

function _findStructDefinitionByReference(
  sourceUnits: SourceUnit[],
  typeName: UserDefinedTypeName
) {
  const definitions = findAll(
    sourceUnits,
    'StructDefinition',
    (node) => node.id === typeName.referencedDeclaration
  );

  if (!definitions.length) {
    throw new Error(
      `Could not find nested struct definition corresponding to "${typeName.typeDescriptions.typeString}"`
    );
  }

  if (definitions.length > 1) {
    throw new Error(
      `Found more than one struct definition corresponding to "${typeName.typeDescriptions.typeString}"`
    );
  }

  return definitions[0];
}

/**
 * Parse a previous generated storage dump
 */
export function parseStorageDump(source: string) {
  const [header, ...contractChunks] = source.split('// @custom:artifact ');

  const contents: { [fqName: string]: string } = {};
  for (const chunk of contractChunks) {
    const [fqName] = chunk.split('\n', 1);
    const sourceCode = chunk.slice(fqName.length);
    contents[fqName.trim()] = `${header}${sourceCode.trim()}\n`;
  }

  return contents;
}
