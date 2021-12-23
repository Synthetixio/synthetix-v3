const { findContractNodeVariables, findContractNodeStructs } = require('./finders');

// prettier-ignore
function orderContractsStructMap(structs) {
  structs.sort((a, b) =>
    a.contract.name > b.contract.name
      ? 1
      : a.contract.name < b.contract.name
        ? -1
        : a.struct.name > b.struct.name
          ? 1
          : a.struct.name < b.struct.name
            ? -1
            : 0
  );
}

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

  orderContractsStructMap(structs);

  return structs;
}

module.exports = {
  buildContractsStructMap,
};
