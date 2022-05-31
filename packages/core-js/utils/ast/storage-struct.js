const { findContractNodeVariables, findContractNodeStructs } = require('./finders');

async function buildContractsStructMap(contractNodes) {
  const structs = [];

  for (const contractNode of contractNodes) {
    for (const structDefinition of findContractNodeStructs(contractNode)) {
      let members = [];

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

function _flatStructMembers(contractNodes, canonicalName, members) {
  for (const currentContractNode of contractNodes) {
    for (const currentStructDefinition of findContractNodeStructs(currentContractNode)) {
      if (canonicalName === currentStructDefinition.canonicalName) {
        for (const member of findContractNodeVariables(currentStructDefinition)) {
          members.push({
            name: member.name,
            type: member.typeDescriptions.typeString,
            contractName: currentContractNode.name,
            contractId: currentContractNode.id,
          });

          if (member.typeDescriptions.typeString.startsWith('struct')) {
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

function _orderContractsStructMap(structs) {
  structs.sort((a, b) => (a.contract.name >= b.contract.name ? 1 : -1));
}

module.exports = {
  buildContractsStructMap,
};
