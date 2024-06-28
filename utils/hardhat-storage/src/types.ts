import type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export type { SourceUnit };

export interface StorageArtifact {
  sourceName: string;
  ast: SourceUnit;
}

export interface OldStorageArtifact extends StorageArtifact {
  contractName: string;
}

export type GetArtifactFunction = (sourceName: string) => Promise<StorageArtifact>;

export interface StorageSlotBase {
  type: string;
  name?: string;
  size?: number;
  slot?: string;
  offset?: number;
}

export type StorageBuiltInValueType =
  | 'bool'
  | 'address'
  | `uint${number}`
  | `int${number}`
  | `bytes${number}`
  | `ufixed${number}x${number}`
  | `fixed${number}x${number}`
  | 'bytes'
  | 'string';

export interface StorageBuiltinValueSlot extends StorageSlotBase {
  type: StorageBuiltInValueType;
}

export interface StorageEnumSlot extends StorageSlotBase {
  type: 'enum';
  members: string[];
}

export interface StorageStructSlot extends StorageSlotBase {
  type: 'struct';
  members: StorageSlot[];
}

export interface StorageMappingSlot extends StorageSlotBase {
  type: 'mapping';
  key: StorageBuiltinValueSlot;
  value: StorageSlot;
}

export interface StorageArraySlot extends StorageSlotBase {
  type: 'array';
  value: StorageSlot;
  length?: number;
}

export type StorageSlot =
  | StorageBuiltinValueSlot
  | StorageStructSlot
  | StorageMappingSlot
  | StorageArraySlot
  | StorageEnumSlot;

export type StorageLayoutStructs = { [structName: string]: StorageSlot[] | undefined };

export interface StorageLayout {
  kind: 'contract' | 'library';
  name: string;
  structs: StorageLayoutStructs;
}

export interface StorageDump {
  [contractName: string]: StorageLayout | undefined;
}

export interface StorageMutation {
  type: 'log' | 'warn' | 'error';
  kind: 'add' | 'update' | 'del';
  message: string;
}
