import { ContractDefinition, StructDefinition } from 'solidity-ast';

import { findContractNodeStructs, findContractNodeVariables } from './finders';

export type StructMember = {
  name: string;
  type: string | null;
  contractName: string;
  contractId: number;
};

export type ContractsStruct = {
  contract: { name: string; id: number };
  struct: { name: string; members: StructMember[] };
};

export async function buildContractsStructMap(contractNodes: ContractDefinition[]) {
  const structs: ContractsStruct[] = [];

  for (const contractNode of contractNodes) {
    for (const structDefinition of findContractNodeStructs(contractNode)) {
      let members: StructMember[] = [];

      members = _flatStructMembers(contractNodes, structDefinition.canonicalName, members);

      structs.push({
        contract: { name: contractNode.name, id: contractNode.id },
        struct: { name: structDefinition.name, members },
      });
    }
  }

  _orderContractsStructMap(structs);

  return structs;
}

function _flatStructMembers(
  contractNodes: ContractDefinition[],
  canonicalName: string,
  members: StructMember[]
) {
  for (const currentContractNode of contractNodes) {
    for (const currentStructDefinition of findContractNodeStructs(currentContractNode)) {
      if (canonicalName === currentStructDefinition.canonicalName) {
        for (const member of findContractNodeVariables(
          currentStructDefinition as StructDefinition
        )) {
          // TODO
          members.push({
            name: member.name,
            type: member.typeDescriptions.typeString || null,
            contractName: currentContractNode.name,
            contractId: currentContractNode.id,
          });

          if (
            member.typeDescriptions &&
            member.typeDescriptions.typeString &&
            member.typeDescriptions.typeString.startsWith('struct')
          ) {
            _flatStructMembers(
              contractNodes,
              member.typeDescriptions.typeString.replace('struct ', ''),
              members
            );
          }
        }
      }
    }
  }

  return members;
}

function _orderContractsStructMap(structs: ContractsStruct[]) {
  structs.sort((a, b) => (a.contract.name >= b.contract.name ? 1 : -1));
}
