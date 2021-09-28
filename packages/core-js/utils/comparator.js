function compareStorageStructs({ previousStructsMap, currentStructsMap }) {
  const additions = [];
  const modifications = [];
  const removals = [];
  for (const previousStruct of previousStructsMap) {
    const currentStruct = findStructInList(previousStruct, currentStructsMap);
    if (!currentStruct) {
      removals.push({
        completeStruct: true,
        contract: previousStruct.contract.name,
        struct: previousStruct.struct.name,
      });
    }
  }
  for (const currentStruct of currentStructsMap) {
    const previousStruct = findStructInList(currentStruct, previousStructsMap);
    if (!previousStruct) {
      additions.push({
        completeStruct: true,
        contract: currentStruct.contract.name,
        struct: currentStruct.struct.name,
      });
      continue;
    }
    const {
      additions: mAdditions,
      modifications: mModifications,
      removals: mRemovals,
    } = getMemberUpdates(previousStruct, currentStruct);
    additions.push(...mAdditions);
    modifications.push(...mModifications);
    removals.push(...mRemovals);
  }
  return { additions, modifications, removals };
}

function findStructInList(element, listOfElements) {
  return listOfElements.find(
    (v) => v.contract.name === element.contract.name && v.struct.name === element.struct.name
  );
}

function getMemberUpdates(previousStruct, currentStruct) {
  const additions = [];
  const modifications = [];
  const removals = [];
  const longest =
    currentStruct.struct.members.length > previousStruct.struct.members.length
      ? currentStruct.struct.members.length
      : previousStruct.struct.members.length;
  for (let i = 0; i < longest; i++) {
    const current = currentStruct.struct.members[i];
    const previous = previousStruct.struct.members[i];
    if (!current) {
      removals.push({
        contract: previousStruct.contract.name,
        struct: previousStruct.struct.name,
        old: previous,
      });
      continue;
    }
    if (!previous) {
      additions.push({
        contract: currentStruct.contract.name,
        struct: currentStruct.struct.name,
        new: current,
      });
      continue;
    }
    if (current.name !== previous.name || current.type !== previous.type) {
      modifications.push({
        contract: currentStruct.contract.name,
        struct: currentStruct.struct.name,
        old: previous,
        new: current,
      });
    }
  }
  return { additions, modifications, removals };
}

module.exports = {
  compareStorageStructs,
};
