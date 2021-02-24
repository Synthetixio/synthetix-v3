const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { subtask } = require('hardhat/config');
const { SUBTASK_GENERATE_ROUTER_SOURCE } = require('../task-names');
const { getAllSelectors } = require('../utils/getSelectors');
const { getCommit, getBranch } = require('../utils/git');
const { readPackageJson } = require('../utils/package');
const { readRouterSource } = require('../utils/routerSource');

const TAB = '    ';

let _hre;

/*
 * Reads deployed modules from the deployment data file
 * and generates the source for a new router contract.
 * */
subtask(SUBTASK_GENERATE_ROUTER_SOURCE).setAction(async (_, hre) => {
  _hre = hre;

  logger.subtitle('Generating router source');

  const sources = hre.deployer.sources;
  logger.debug(`modules: ${JSON.stringify(sources, null, 2)}`);

  const selectors = await getAllSelectors({ hre });
  logger.debug(`selectors: ${JSON.stringify(selectors, null, 2)}`);
  logger.info(`Found ${sources.length} modules with ${selectors.length} selectors in total`);

  const binaryData = _buildBinaryData({ selectors });

  const package = readPackageJson({ hre });

  const currentSource = readRouterSource({ hre });
  const generatedSource = _readRouterTemplate()
    .replace('@project', package.name)
    .replace('@repo', package.repository.url)
    .replace('@branch', getBranch())
    .replace('@commit', getCommit())
    .replace('@network', _hre.network.name)
    .replace('@modules', _renderModules({ modules: sources }))
    .replace('@selectors', _renderSelectors({ binaryData }));

  logger.debug(`generated source: ${generatedSource}`);

  if (currentSource !== generatedSource) {
    const routerPath = path.join(_hre.config.paths.sources, `Router_${_hre.network.name}.sol`);
    fs.writeFileSync(routerPath, generatedSource);

    logger.complete(`Router code generated and written to ${routerPath}`);
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

    modulesStr += `\n${TAB.repeat(1)}address private constant _${module.toUpperCase()} = ${
      _hre.deployer.data.modules[module].deployedAddress
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

function _readRouterTemplate() {
  return fs.readFileSync(path.join(__dirname, '../templates/Router'), 'utf8');
}
