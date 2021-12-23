const { findContractNodeVariables, findContractNodeStructs } = require('./finders');

async function buildContractsStructMap(contractNodes) {
  const structs = [];

  for (const contractNode of contractNodes) {
    for (const structDefinition of findContractNodeStructs(contractNode)) {
      const members = [];

      for (const member of findContractNodeVariables(structDefinition)) {
        members.push({ name: member.name, type: member.typeDescriptions.typeString });
      }

      structs.push({
        contract: { name: contractNode.name, id: contractNode.id },
        struct: { name: structDefinition.name, members },
      });
    }
  }

  console.log(structs);
  _orderContractsStructMap(structs);

  return structs;
}

function _orderContractsStructMap(structs) {
  structs.sort((a, b) => {
    if (a.contract.name >= b.contract.name) {
      return 1;
    } else {
      return -1;
    }
  });
}

module.exports = {
  buildContractsStructMap,
};
