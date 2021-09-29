const {
  findContractNodeWithName,
  findContractNodeVariables,
  findContractNodeStructs,
} = require('./finders');

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

async function buildContractsStructMap(asts) {
  const structs = [];
  for (var [contractName, ast] of Object.entries(asts)) {
    const contractNode = findContractNodeWithName(contractName, ast);
    if (!contractNode) {
      continue;
    }
    for (const structDefinition of findContractNodeStructs(contractNode)) {
      const members = [];
      for (const member of findContractNodeVariables(structDefinition)) {
        members.push({ name: member.name, type: member.typeDescriptions.typeString });
      }
      structs.push({
        contract: { name: contractName, id: contractNode.id },
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
