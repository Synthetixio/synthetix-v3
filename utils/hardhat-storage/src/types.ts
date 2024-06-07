import type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export type { SourceUnit } from '@solidity-parser/parser/src/ast-types';

export interface StorageArtifact {
  sourceName: string;
  ast: SourceUnit;
}

export interface OldStorageArtifact extends StorageArtifact {
  contractName: string;
}

export type GetArtifactFunction = (sourceName: string) => Promise<StorageArtifact>;

export interface StorageDumpSlotBase {
  type: string;
  name?: string;
}

export type StorageDumpBuiltInValueType =
  | 'bool'
  | 'address'
  | `uint${number}`
  | `int${number}`
  | `bytes${number}`
  | 'bytes'
  | 'string';

export interface StorageDumpBuiltInValueSlot extends StorageDumpSlotBase {
  type: StorageDumpBuiltInValueType;
}

export interface StorageDumpStructSlot extends StorageDumpSlotBase {
  type: 'struct';
  members: StorageDumpSlot[];
}

export interface StorageDumpMappingSlot extends StorageDumpSlotBase {
  type: 'mapping';
  key: StorageDumpBuiltInValueSlot;
  value: StorageDumpSlot;
}

export interface StorageDumpArraySlot extends StorageDumpSlotBase {
  type: 'array';
  value: StorageDumpSlot;
  range: [number, number] | null;
}

export interface StorageDumpEnumSlot extends StorageDumpSlotBase {
  type: 'enum';
  members: string[];
}

export type StorageDumpSlot =
  | StorageDumpBuiltInValueSlot
  | StorageDumpStructSlot
  | StorageDumpMappingSlot
  | StorageDumpArraySlot
  | StorageDumpEnumSlot;

export interface StorageDumpLayout {
  kind: 'contract' | 'library';
  name: string;
  structs: { [structName: string]: StorageDumpSlot[] };
}

export interface StorageDump {
  [contractName: string]: StorageDumpLayout;
}
