const path = require('path');
const fs = require('fs');

function getContractDataFromDebugFile(debugFileName) {
  const filename = path.parse(debugFileName).base;
  const contractName = filename ? filename.substring(0, filename.indexOf('.dbg.json')) : null;
  const contractPath = path.parse(debugFileName).dir;
  return { contractName, contractPath };
}

function getDebugDataFile(filename, contractPath) {
  const debugFile = JSON.parse(fs.readFileSync(filename));
  const debugFilePath = path.join(contractPath, debugFile.buildInfo);
  return JSON.parse(fs.readFileSync(debugFilePath));
}

function getSlotAddress(contractName, sources) {
  const contractNode = findNode('name', contractName, sources, false);
  const slotNode = findNodeParent('name', 'store.slot', contractNode);
  if (slotNode && slotNode.value && slotNode.value.value) {
    return slotNode.value.value;
  }
  return null;
}

function findNode(key, value, currentNode, isAst) {
  const keys = Object.keys(currentNode);
  if (!isAst) {
    for (let i = 0; i < keys.length; i += 1) {
      if (currentNode[keys[i]].ast) {
        const result = findNode(key, value, currentNode[keys[i]].ast, true);
        if (result !== null) {
          return result;
        }
      }
    }
    return null;
  }
  // Continue. Now we are working with an AST object
  if (
    currentNode &&
    typeof currentNode === 'object' &&
    key in currentNode &&
    currentNode[key] === value
  ) {
    return currentNode;
  } else {
    for (let i = 0; i < keys.length; i += 1) {
      if (Array.isArray(currentNode[keys[i]])) {
        const currentArray = currentNode[keys[i]];

        for (let j = 0; j < currentArray.length; j += 1) {
          const currentChild = currentArray[j];
          // Search in the current child
          const result = findNode(key, value, currentChild, true);

          // Return the result if the node has been found
          if (result !== null) {
            return result;
          }
        }
      }
    }
  }
  return null;
}

function findNodeParent(key, value, currentNodeOriginal) {
  let found = false;
  if (!currentNodeOriginal) return null;
  let currentNode = currentNodeOriginal;
  if (currentNode.body) {
    currentNode = currentNode.body;
  }
  if (currentNode.AST) {
    currentNode = currentNode.AST;
  }
  const keys = currentNode.AST ? Object.keys(currentNode.AST) : Object.keys(currentNode);

  // Look for the children
  for (let i = 0; i < keys.length; i += 1) {
    if (Array.isArray(currentNode[keys[i]])) {
      const currentArray = currentNode[keys[i]];

      for (let j = 0; j < currentArray.length; j += 1) {
        const currentChild = currentArray[j];

        if (currentChild[key] && currentChild[key] === value) {
          found = true;
          break;
        }
      }
    }
    if (found) break;
  }

  if (found) return currentNode;

  for (let i = 0; i < keys.length; i += 1) {
    if (Array.isArray(currentNode[keys[i]])) {
      const currentArray = currentNode[keys[i]];

      for (let j = 0; j < currentArray.length; j += 1) {
        const currentChild = currentArray[j];
        // Search in the current child
        const result = findNodeParent(key, value, currentChild);

        // Return the result if the node has been found
        if (result !== null) {
          return result;
        }
      }
    }
  }
  return null;
}

function findDuplicateSlots(slots) {
  const duplicates = slots
    .map((s) => s.slotAddress)
    .filter((s, index, slots) => slots.indexOf(s) !== index);

  const ocurrences = [];

  if (duplicates.length > 0) {
    duplicates.map((duplicate) => {
      const cases = slots.filter((s) => s.slotAddress === duplicate);
      ocurrences.push({
        slotAddress: duplicate,
        contracts: cases.map((c) => c.contractName),
      });
    });
  }

  return ocurrences.length > 0 ? ocurrences : null;
}
module.exports = {
  getContractDataFromDebugFile,
  getDebugDataFile,
  getSlotAddress,
  findDuplicateSlots,
};
