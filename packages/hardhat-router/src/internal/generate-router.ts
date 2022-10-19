import { JsonFragment } from '@ethersproject/abi';
import { getSelectors } from '@synthetixio/core-utils/utils/ethers/contracts';
import { renderTemplate } from './generate-contracts';
import { toPrivateConstantCase } from './router-helper';

const TAB = '    ';

interface Props {
  routerName: string;
  template: string;
  contracts: ContractData[];
}

interface ContractData {
  contractName: string;
  deployedAddress: string;
  abi: ReadonlyArray<JsonFragment>;
}

interface FunctionSelector {
  contractName: string;
  name: string;
  selector: string;
}

interface BinaryData {
  selectors: FunctionSelector[];
  children: BinaryData[];
}

export function generateRouter({ routerName = 'Router', template, contracts }: Props) {
  const selectors = _getAllSelectors(contracts);
  const binaryData = _buildBinaryData(selectors);

  return renderTemplate(template, {
    moduleName: routerName,
    modules: _renderModules(contracts),
    selectors: _renderSelectors(binaryData),
  });
}

function _getAllSelectors(contracts: ContractData[]): FunctionSelector[] {
  return contracts.flatMap(({ contractName, abi }) =>
    getSelectors(abi).map((s) => ({
      contractName,
      ...s,
    }))
  );
}

function _renderSelectors(binaryData: BinaryData) {
  let selectorsStr = '';

  function renderNode(node: BinaryData, indent = 0) {
    if (node.children.length > 0) {
      const childA = node.children[0];
      const childB = node.children[1];

      function findMidSelector(node: BinaryData): FunctionSelector {
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
        } { result := ${toPrivateConstantCase(s.contractName)} } // ${s.contractName}.${s.name}()`;
      }
      selectorsStr += `\n${TAB.repeat(4 + indent)}leave`;
    }
  }

  renderNode(binaryData, 0);

  return selectorsStr.trim();
}

/**
 * Get a string of modules constants with its deployedAddresses.
 * E.g.:
 *   address private constant _ANOTHER_MODULE = 0xAA...;
 *   address private constant _OWNER_MODULE = 0x5c..;
 */
function _renderModules(contracts: ContractData[]) {
  return contracts
    .map(({ contractName, deployedAddress }) => {
      const name = toPrivateConstantCase(contractName);
      return `${TAB}address private constant ${name} = ${deployedAddress};`;
    })
    .join('\n')
    .trim();
}

function _buildBinaryData(selectors: FunctionSelector[]) {
  const maxSelectorsPerSwitchStatement = 9;

  function binarySplit(node: BinaryData) {
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

  const binaryData = {
    selectors,
    children: [],
  };

  const finalData = binarySplit(binaryData);

  return finalData;
}
