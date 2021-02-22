const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../task-names');
const { getSelectors } = require('../utils/getSelectors');
const { readDeploymentFile } = require('../utils/deploymentFile');
const { getCommit, getBranch } = require('../utils/git');
const { readPackageJson } = require('../utils/package');

const TAB = '    ';

let _hre;

/*
 * Reads deployed modules from the deployment data file
 * and generates the source for a new router contract.
 * */
subtask(SUBTASK_GENERATE_ROUTER_SOURCE).setAction(async (_, hre) => {
  _hre = hre;

  logger.subtitle('Generating router source');

  const data = readDeploymentFile({ hre });

  const modules = _collectModules({ data });
  const selectors = await _collectSelectors({ modules });

  const binaryData = _buildBinaryData({ selectors });

  const package = readPackageJson({ hre });

  const currentSource = _readRouterSource();
  const generatedSource = _readRouterTemplate()
    .replace('@project', package.name)
    .replace('@repo', package.repository.url)
    .replace('@branch', getBranch())
    .replace('@commit', getCommit())
    .replace('@network', _hre.network.name)
    .replace('@modules', _renderModules({ modules }))
    .replace('@selectors', _renderSelectors({ binaryData }));

  logger.debug(`generated source: ${generatedSource}`);

  if (currentSource !== generatedSource) {
    fs.writeFileSync(`contracts/Router_${_hre.network.name}.sol`, generatedSource);

    logger.complete('Router code generated!');
  } else {
    logger.checked('Router source did not change');
  }
});

function _readRouterSource() {
  const routerName = `Router_${_hre.network.name}.sol`;
  const routerPath = `contracts/${routerName}`;

  if (fs.existsSync(routerPath)) {
    return fs.readFileSync(routerPath, 'utf8');
  }

  return '';
}

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
        } { result := _${s.module.toUpperCase()} } // ${s.module}.${s.name}()`;
      }
      selectorsStr += `\n${TAB.repeat(4 + indent)}leave`;
    }
  }

  renderNode(binaryData, 0);

  return selectorsStr;
}

function _renderModules({ modules }) {
  let modulesStr = '';

  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];

    modulesStr += `\n${TAB.repeat(1)}address private constant _${module.name.toUpperCase()} = ${
      module.address
    };`;
  }

  return modulesStr;
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

function _collectModules({ data }) {
  const allModules = Object.keys(data.modules).map((moduleName) => {
    const { deployedAddress } = data.modules[moduleName];

    return {
      name: moduleName,
      address: deployedAddress,
    };
  });

  logger.debug(`modules: ${JSON.stringify(allModules, null, 2)}`);

  return allModules;
}

async function _collectSelectors({ modules }) {
  let allSelectors = [];

  for (let module of modules) {
    let selectors = await getSelectors({ contractName: module.name, hre: _hre });

    selectors.map((s) => (s.module = module.name));

    allSelectors = allSelectors.concat(selectors);
  }

  allSelectors = allSelectors.sort((a, b) => {
    return parseInt(a.selector, 16) - parseInt(b.selector, 16);
  });

  logger.debug(`selectors: ${JSON.stringify(allSelectors, null, 2)}`);
  logger.info(`Found ${modules.length} modules with ${allSelectors.length} selectors in total`);

  return allSelectors;
}

function _readRouterTemplate() {
  return fs.readFileSync(path.join(__dirname, '../templates/Router'), 'utf8');
}
