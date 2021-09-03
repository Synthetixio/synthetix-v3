const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../task-names');
const { getCommit, getBranch } = require('../utils/git');
const { readPackageJson } = require('../utils/package');
const { getContractSelectors, getContractNameFromPath } = require('../utils/contracts');

const TAB = '    ';

subtask(
  SUBTASK_GENERATE_ROUTER_SOURCE,
  'Reads deployed modules from the deployment data file and generates the source for a new router contract.'
).setAction(async (_, hre) => {
  logger.subtitle('Generating router source');

  const modulesPaths = Object.keys(hre.deployer.data.contracts.modules);
  logger.debug(`modules: ${JSON.stringify(modulesPaths, null, 2)}`);

  const selectors = await _getAllSelectors(modulesPaths);
  logger.debug(`selectors: ${JSON.stringify(selectors, null, 2)}`);
  logger.info(`Found ${modulesPaths.length} modules with ${selectors.length} selectors in total`);

  const binaryData = _buildBinaryData({ selectors });

  const package = readPackageJson();

  const generatedSource = _readRouterTemplate()
    .replace('@project', package.name)
    .replace('@repo', package.repository?.url || '')
    .replace('@branch', getBranch())
    .replace('@commit', getCommit())
    .replace('@network', hre.network.name)
    .replace('@modules', _renderModules(hre.deployer.data.contracts.modules))
    .replace('@selectors', _renderSelectors({ binaryData }));

  logger.debug(`generated source: ${generatedSource}`);

  const { routerPath } = hre.deployer.paths;
  const currentSource = fs.existsSync(routerPath) ? fs.readFileSync(routerPath) : '';
  if (currentSource !== generatedSource) {
    fs.writeFileSync(routerPath, generatedSource);
    logger.success(`Router code generated and written to ${routerPath}`);
  } else {
    logger.checked('Router source did not change');
  }
});

function _renderSelectors({ binaryData }) {
  let selectorsStr = '';

  function renderNode(node, indent) {
    if (node.children.length > 0) {
      const childA = node.children[0];
      const childB = node.children[1];

      function findMidSelector(node) {
        if (node.selectors.length > 0) {
          return node.selectors[0];
        } else {
          return findMidSelector(node.children[0]);
        }
      }
      const midSelector = findMidSelector(childB);

      selectorsStr += `\n${TAB.repeat(4 + indent)}if lt(sig,${midSelector.selector}) {`;
      renderNode(childA, indent + 1);
      selectorsStr += `\n${TAB.repeat(4 + indent)}}`;

      renderNode(childB, indent);
    } else {
      selectorsStr += `\n${TAB.repeat(4 + indent)}switch sig`;
      for (const s of node.selectors) {
        selectorsStr += `\n${TAB.repeat(4 + indent)}case ${
          s.selector
        } { result := _${s.contractName.toUpperCase()} } // ${s.contractName}.${s.name}()`;
      }
      selectorsStr += `\n${TAB.repeat(4 + indent)}leave`;
    }
  }

  renderNode(binaryData, 0);

  return selectorsStr;
}

/**
 * Get a string of modules constants with its deployedAddresses.
 * E.g.:
 *   address private constant _ANOTHERMODULE = 0xAA...;
 *   address private constant _OWNERMODULE = 0x5c..;
 */
function _renderModules(modules) {
  return Object.entries(modules).reduce((modulesStr, [modulePath, moduleData]) => {
    const moduleName = getContractNameFromPath(modulePath);
    const { deployedAddress } = moduleData;
    return (
      modulesStr +
      `\n${TAB}address private constant _${moduleName.toUpperCase()} = ${deployedAddress};`
    );
  }, '');
}

async function _getAllSelectors(contractsPaths) {
  const allSelectors = [];

  for (const contractPath of contractsPaths) {
    const contractName = getContractNameFromPath(contractPath);
    const selectors = await getContractSelectors(contractName);

    allSelectors.push(...selectors.map((s) => ({ ...s, contractName })));
  }

  return allSelectors.sort((a, b) => {
    return Number.parseInt(a.selector, 16) - Number.parseInt(b.selector, 16);
  });
}

function _buildBinaryData({ selectors }) {
  const maxSelectorsPerSwitchStatement = 9;

  function binarySplit(node) {
    if (node.selectors.length > maxSelectorsPerSwitchStatement) {
      const midIdx = Math.ceil(node.selectors.length / 2);

      const childA = binarySplit({
        selectors: node.selectors.splice(0, midIdx),
        children: [],
      });

      const childB = binarySplit({
        selectors: node.selectors.splice(-midIdx),
        children: [],
      });

      node.children.push(childA);
      node.children.push(childB);

      node.selectors = [];
    }

    return node;
  }

  let binaryData = {
    selectors,
    children: [],
  };

  const finalData = binarySplit(binaryData);

  logger.debug(`binary tree: ${JSON.stringify(finalData, null, 2)}`);

  return finalData;
}

function _readRouterTemplate() {
  return fs.readFileSync(path.resolve(__dirname, '../templates/Router.sol.template')).toString();
}
