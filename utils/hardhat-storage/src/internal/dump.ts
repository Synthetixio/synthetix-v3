import {
  ContractDefinition,
  TypeName,
  VariableDeclaration,
} from '@solidity-parser/parser/src/ast-types';
import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import {
  GetArtifactFunction,
  StorageArtifact,
  StorageDump,
  StorageArraySlot,
  StorageBuiltinValueSlot,
  StorageBuiltInValueType,
  StorageLayout,
  StorageSlot,
  StorageSlotBase,
} from '../types';
import { findNodeReferenceWithArtifact } from './artifacts';
import { findAll, findContract } from './finders';
import { getStorageSlotSize } from './layout';

interface ContractOrLibrary extends ContractDefinition {
  kind: 'contract' | 'library';
}

interface Params {
  getArtifact: GetArtifactFunction;
  contracts: string[];
  version?: string;
  license?: string;
}

export async function dumpStorage({ getArtifact, contracts }: Params) {
  const results: StorageDump = {};

  for (const [artifact, contractNode] of await _getContracts(getArtifact, contracts)) {
    const result: StorageLayout = {
      name: contractNode.name,
      kind: contractNode.kind,
      structs: {},
    };

    const contractName = contractNode.name;
    const sourceName = artifact.sourceName;
    const fqName = `${sourceName}:${contractName}`;

    for (const structDefinition of findAll(contractNode, 'StructDefinition')) {
      const struct: StorageSlot[] = [];

      for (const member of structDefinition.members) {
        const storageSlot = await _astVariableToStorageSlot(getArtifact, artifact, member);
        struct.push(storageSlot);
      }

      if (struct.length) {
        result.structs[structDefinition.name] = struct;
      }
    }

    if (Object.keys(result.structs).length > 0) {
      results[fqName] = result;
    }
  }

  return results;
}

async function _astVariableToStorageSlot(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  member: VariableDeclaration
) {
  if (!member.typeName) throw new Error('Missing type notation');
  if (!member.name) throw new Error('Missing name notation');
  return _typeNameToStorageSlot(getArtifact, artifact, member.typeName, member.name);
}

/**
 * Utility function to convert the given AST typeName elements in StorageSlot that
 * then can be used to calculate a complete Storage Layout with sizes and locations.
 */
async function _typeNameToStorageSlot(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  typeName: TypeName,
  name?: string
): Promise<StorageSlot> {
  const _createSlot = (attrs: StorageSlot) => {
    const { type, ...restAttrs } = attrs;
    // order keys for consistency:
    const slot = (name ? { type, name, ...restAttrs } : { type, ...restAttrs }) as StorageSlot;

    return slot;
  };

  const _error = (msg: string) => {
    const err = new Error(`"${typeName.type}": ${msg}`);
    (err as any).typeName = typeName;
    throw err;
  };

  if (typeName.type === 'ElementaryTypeName') {
    const type = _getBuiltInValueType(typeName.name);
    return _createSlot({ type });
  }

  if (typeName.type === 'ArrayTypeName') {
    const value = await _typeNameToStorageSlot(
      getArtifact,
      artifact,
      typeName.baseTypeName,
      typeName.baseTypeName.type === 'UserDefinedTypeName'
        ? typeName.baseTypeName.namePath
        : undefined
    );

    const slot = _createSlot({ type: 'array', value });

    if (typeName.range) _error('array values with range not implemented');

    if (typeName.length) {
      if (typeName.length.type === 'NumberLiteral') {
        (slot as StorageArraySlot).length = Number.parseInt(typeName.length.number);
      } else {
        _error('array length with custom value not implemented');
      }
    }

    return slot;
  }

  if (typeName.type === 'Mapping') {
    const [key, value] = await Promise.all([
      _typeNameToStorageSlot(
        getArtifact,
        artifact,
        typeName.keyType,
        typeName.keyName?.name || undefined
      ),
      _typeNameToStorageSlot(
        getArtifact,
        artifact,
        typeName.valueType,
        typeName.valueName?.name || undefined
      ),
    ]);

    if (!_isBuiltInType(key)) {
      throw new Error('Invalid key type for mapping');
    }

    return _createSlot({ type: 'mapping', key, value });
  }

  if (typeName.type === 'UserDefinedTypeName') {
    const [referenceArtifact, referenceNode] = await findNodeReferenceWithArtifact(
      getArtifact,
      ['ContractDefinition', 'StructDefinition', 'EnumDefinition'],
      artifact,
      typeName.namePath
    );

    // If it is a reference to a contract, replace the type as `address`
    if (referenceNode.type === 'ContractDefinition') {
      return _createSlot({ type: 'address' });
    }

    if (referenceNode.type === 'EnumDefinition') {
      const members = referenceNode.members.map((m) => m.name);
      return _createSlot({ type: 'enum', members });
    }

    // handle structs
    const members = await Promise.all(
      referenceNode.members.map((childMember) =>
        _astVariableToStorageSlot(getArtifact, referenceArtifact, childMember)
      )
    ).then((result) => result.flat());

    return _createSlot({ type: 'struct', members });
  }

  const err = new Error(`"${typeName.type}" not implemented for generating storage layout`);
  (err as any).typeName = typeName;
  throw err;
}

function _isBuiltInType(storageSlot: StorageSlotBase): storageSlot is StorageBuiltinValueSlot {
  try {
    _getBuiltInValueType(storageSlot.type);
    return true;
  } catch (_) {
    return false;
  }
}

const FIXED_SIZE_VALUE_REGEX = /^((?:int|uint|bytes)[0-9]+|(?:ufixed|fixed)[0-9]+x[0-9]+)$/;
function _isFixedBuiltInValueType(typeName: string): typeName is StorageBuiltInValueType {
  return FIXED_SIZE_VALUE_REGEX.test(typeName);
}

const _typeValueNormalizeMap = {
  int: 'int256',
  uint: 'uint256',
  byte: 'bytes1',
  ufixed: 'ufixed128x18',
  fixed: 'fixed128x18',
} as { [k: string]: StorageBuiltInValueType };

function _getBuiltInValueType(typeName: string): StorageBuiltInValueType {
  if (typeof typeName !== 'string' || !typeName) throw new Error(`Invalid typeName ${typeName}`);
  if (['bool', 'address', 'bytes', 'string'].includes(typeName))
    return typeName as StorageBuiltInValueType;
  if (_typeValueNormalizeMap[typeName]) return _typeValueNormalizeMap[typeName];
  if (_isFixedBuiltInValueType(typeName)) return typeName;
  throw new Error(`Invalid typeName ${typeName}`);
}

async function _getContracts(getArtifact: GetArtifactFunction, contracts: string[]) {
  return Promise.all(
    contracts.map(async (fqName) => {
      const { sourceName, contractName } = parseFullyQualifiedName(fqName);
      const artifact = await getArtifact(sourceName);
      const contractNode = findContract(artifact.ast, contractName, (node) =>
        ['contract', 'library'].includes(node.kind)
      ) as ContractOrLibrary;
      if (!contractNode) return;
      return [artifact, contractNode];
    })
  ).then((results) => results.filter(Boolean) as [StorageArtifact, ContractOrLibrary][]);
}
