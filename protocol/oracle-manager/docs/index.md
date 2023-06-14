# Solidity API

## Node Module

### registerNode

  ```solidity
  function registerNode(enum NodeDefinition.NodeType nodeType, bytes parameters, bytes32[] parents) external returns (bytes32 nodeId)
  ```

  Registers a node

**Parameters**
* `nodeType` (*enum NodeDefinition.NodeType*) - The nodeType assigned to this node.
* `parameters` (*bytes*) - The parameters assigned to this node.
* `parents` (*bytes32[]*) - The parents assigned to this node.

**Returns**
* `nodeId` (*bytes32*) - The id of the registered node.
### getNodeId

  ```solidity
  function getNodeId(enum NodeDefinition.NodeType nodeType, bytes parameters, bytes32[] parents) external returns (bytes32 nodeId)
  ```

  Returns the ID of a node, whether or not it has been registered.

**Parameters**
* `nodeType` (*enum NodeDefinition.NodeType*) - The nodeType assigned to this node.
* `parameters` (*bytes*) - The parameters assigned to this node.
* `parents` (*bytes32[]*) - The parents assigned to this node.

**Returns**
* `nodeId` (*bytes32*) - The id of the node.
### getNode

  ```solidity
  function getNode(bytes32 nodeId) external view returns (struct NodeDefinition.Data node)
  ```

  Returns a node's definition (type, parameters, and parents)

**Parameters**
* `nodeId` (*bytes32*) - The node ID

**Returns**
* `node` (*struct NodeDefinition.Data*) - The node's definition data
### process

  ```solidity
  function process(bytes32 nodeId) external view returns (struct NodeOutput.Data node)
  ```

  Returns a node current output data

**Parameters**
* `nodeId` (*bytes32*) - The node ID

**Returns**
* `node` (*struct NodeOutput.Data*) - The node's output data

### NodeRegistered

  ```solidity
  event NodeRegistered(bytes32 nodeId, enum NodeDefinition.NodeType nodeType, bytes parameters, bytes32[] parents)
  ```

  Emitted when `registerNode` is called.

**Parameters**
* `nodeId` (*bytes32*) - The id of the registered node.
* `nodeType` (*enum NodeDefinition.NodeType*) - The nodeType assigned to this node.
* `parameters` (*bytes*) - The parameters assigned to this node.
* `parents` (*bytes32[]*) - The parents assigned to this node.

## ChainlinkNode

### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

### getTwapPrice

  ```solidity
  function getTwapPrice(contract IAggregatorV3Interface chainlink, uint80 latestRoundId, int256 latestPrice, uint256 twapTimeInterval) internal view returns (int256 price)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal view returns (bool valid)
  ```

## ConstantNode

### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

## ExternalNode

### process

  ```solidity
  function process(struct NodeOutput.Data[] prices, bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal returns (bool valid)
  ```

## PriceDeviationCircuitBreakerNode

### process

  ```solidity
  function process(struct NodeOutput.Data[] parentNodeOutputs, bytes parameters) internal pure returns (struct NodeOutput.Data nodeOutput)
  ```

### abs

  ```solidity
  function abs(int256 x) private pure returns (int256 result)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

## PythNode

### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal view returns (bool valid)
  ```

## ReducerNode

### process

  ```solidity
  function process(struct NodeOutput.Data[] parentNodeOutputs, bytes parameters) internal pure returns (struct NodeOutput.Data nodeOutput)
  ```

### median

  ```solidity
  function median(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data medianPrice)
  ```

### mean

  ```solidity
  function mean(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data meanPrice)
  ```

### recent

  ```solidity
  function recent(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data recentPrice)
  ```

### max

  ```solidity
  function max(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data maxPrice)
  ```

### min

  ```solidity
  function min(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data minPrice)
  ```

### mul

  ```solidity
  function mul(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data mulPrice)
  ```

### div

  ```solidity
  function div(struct NodeOutput.Data[] parentNodeOutputs) internal pure returns (struct NodeOutput.Data divPrice)
  ```

### quickSort

  ```solidity
  function quickSort(struct NodeOutput.Data[] arr, int256 left, int256 right) internal pure
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

## StalenessCircuitBreakerNode

### process

  ```solidity
  function process(struct NodeOutput.Data[] parentNodeOutputs, bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal pure returns (bool valid)
  ```

## UniswapNode

### process

  ```solidity
  function process(bytes parameters) internal view returns (struct NodeOutput.Data nodeOutput)
  ```

### getQuoteAtTick

  ```solidity
  function getQuoteAtTick(int24 tick, uint256 baseAmount, address baseToken, address quoteToken) internal pure returns (uint256 quoteAmount)
  ```

### isValid

  ```solidity
  function isValid(struct NodeDefinition.Data nodeDefinition) internal view returns (bool valid)
  ```

## Router

### fallback

  ```solidity
  fallback() external payable
  ```

### receive

  ```solidity
  receive() external payable
  ```

### _forward

  ```solidity
  function _forward() internal
  ```

