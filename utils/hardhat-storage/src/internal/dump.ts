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
  StorageDumpBuiltInValueSlot,
  StorageDumpBuiltInValueType,
  StorageDumpLayout,
  StorageDumpSlot,
  StorageDumpSlotBase,
} from '../types';
import { findNodeReferenceWithArtifact } from './artifacts';
import { findAll, findContract } from './finders';

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
    const result: StorageDumpLayout = {
      name: contractNode.name,
      kind: contractNode.kind,
      structs: {},
    };

    const contractName = contractNode.name;
    const sourceName = artifact.sourceName;
    const fqName = `${sourceName}:${contractName}`;

    for (const structDefinition of findAll(contractNode, 'StructDefinition')) {
      const struct: StorageDumpSlot[] = [];

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
): Promise<StorageDumpSlot> {
  if (!member.typeName) throw new Error('Missing type notation');
  if (!member.name) throw new Error('Missing name notation');
  return _typeNameToStorageSlot(getArtifact, artifact, member.typeName, member.name);
}

async function _typeNameToStorageSlot(
  getArtifact: GetArtifactFunction,
  artifact: StorageArtifact,
  typeName: TypeName,
  name?: string
): Promise<StorageDumpSlot> {
  if (typeName.type === 'ElementaryTypeName' && _isBuiltInValueType(typeName.name)) {
    return { type: typeName.name, name };
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
    return { type: 'array', name, value, range: typeName.length?.range || null };
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

    return { type: 'mapping', name, key, value };
  }

  if (typeName.type === 'UserDefinedTypeName') {
    const [referenceArtifact, referenceNode] = await findNodeReferenceWithArtifact(
      getArtifact,
      ['ContractDefinition', 'StructDefinition'],
      artifact,
      typeName.namePath
    );

    // If it is a reference to a contract, replace the type as `address`
    if (referenceNode.type === 'ContractDefinition') {
      return { type: 'address', name };
    }

    // handle structs
    const members = await Promise.all(
      referenceNode.members.map((childMember) =>
        _astVariableToStorageSlot(getArtifact, referenceArtifact, childMember)
      )
    ).then((result) => result.flat());

    return { type: 'struct', name, members };
  }

  const err = new Error(`"${typeName.type}" not implemented for generating storage layout`);
  (err as any).typeName = typeName;
  throw err;
}

function _isBuiltInType(
  storageSlot: StorageDumpSlotBase
): storageSlot is StorageDumpBuiltInValueSlot {
  return _isBuiltInValueType(storageSlot.type);
}

const FIXED_SIZE_VALUE_REGEX = /^(uint|int|bytes)[0-9]+$/;
function _isBuiltInValueType(typeName: string): typeName is StorageDumpBuiltInValueType {
  if (typeof typeName !== 'string' || !typeName) throw new Error(`Invalid typeName ${typeName}`);
  if (['uint', 'int'].includes(typeName)) throw new Error('Alias base types not implemented');
  if (['bool', 'address', 'bytes', 'string'].includes(typeName)) return true;
  return FIXED_SIZE_VALUE_REGEX.test(typeName);
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
