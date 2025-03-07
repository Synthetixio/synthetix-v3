# Oracle Manager

The oracle manager is a stateless system which allows price data from multiple sources to be combined using a variety of strategies and reverts to be triggered (i.e. "circuit breaking") under various conditions.

The system consists of nodes which can be registered by anyone using the `registerNode()` function. This returns a `bytes32` identifier for the node, determined by the parameters passed to the function:

- `uint256 nodeType` - The ID corresponding to the desired the node type. (See below for a comprehensive list.)
- `bytes parameters` - The parameter data for the selected node type. (This can be generated using `abi.encode()`.)
- `bytes32[] parents` - The IDs of the parent nodes, if any.

A struct of price data can be retrieved for a given node ID by passing it to the `process()` function. The struct consists of:

```
struct NodeOutput {
  int256 price; // Denominated in dollars with 18 decimal places
  uint256 timestamp; // Denominated as Unix epoch time
  uint256 _unused_1; // Placeholder for additional data in future upgrades, such as volatility or liquidity measurements
  uint256 _unused_2; // Placeholder for additional data in future upgrades, such as volatility or liquidity measurements
}
```

For special cases, you can also call `function processWithRuntime(bytes32 nodeId, bytes32[] memory runtimeKeys, bytes32[] memory runtimeValues)` to pass in an array of runtime keys and values. For example, the _Staleness Circuit Breaker Node_ will respect runtime value that corresponds to `stalenessTolerance` if present in the runtime rather than the staleness tolerance it was initialized with. Runtime data can also be leveraged by external nodes.

## Node Types

There are currently seven types of nodes.

### Chainlink Node

The Chainlink Node retrieves data from a [Chainlink Price Feed](https://docs.chain.link/data-feeds/price-feeds/addresses/). **Note that the timestamp returned by this node is the timestamp of Chainlink's latest update, regardless of the TWAP interval.**

- `nodeType` Value: 3
- Parameters:
  - `address chainlinkAddress` - The address of the Chainlink price feed contract.
  - `uint256 twapTimeInterval` - The duration (in seconds) of the lookback window for price reports to be incorporated in a time-weighted average price calculation. Use `0` to retrieve only the latest price report.
  - `uint8 decimals` - The number of decimals places used by the Chainlink price feed contract. _This must match what is provided by the price feed contract's `decimals()` function_.
- Expected Parents: 0

### Uniswap Node

The Uniswap Node retrieves data from a [Uniswap Oracle](https://docs.uniswap.org/concepts/protocol/oracle). **Note that the timestamp returned by this node is always block.timestamp.**

Use the Uniswap Node with caution. For instance, the implementation of `block.timestamp` on various L2s and the depth of the liquidity available in pools may result in unreliable prices.

- `nodeType` Value: 4
- Parameters:
  - `address tokenAddress` - The address of the token
  - `address stablecoinAddress` - The address of the stablecoin
  - `uint8 tokenDecimals` - The number of decimals places used by the token contract. _This must match what is provided by the token contract's `decimals()` function_.
  - `uint8 stablecoinDecimals` - The number of decimals places used by the stablecoin contract. _This must match what is provided by the stablecoin contract's `decimals()` function_.
  - `address pool` - The address of the Uniswap V3 pool to observe for the price. **Note that pools with deeper liquidity are less subject to price manipulation.**
  - `uint32 secondsAgo` - The duration (in seconds) of the lookback window for prices to be incorporated in a time-weighted average price calculation. **Note that lower values increase this node's susceptibility to price manipulation, but can decrease the accuracy of the present market rate of the asset.**
- Expected Parents: 0

### Pyth Node

The Pyth Node retrieves data from a [Pyth Oracle](https://docs.pyth.network/pythnet-price-feeds/evm). **Note that this returns the latest price, even if it's older than the valid time period associated with the price feed.** Use a _Staleness Circuit Breaker Node_ if this is a concern.

- `nodeType` Value: 5
- Parameters:
  - `address pythAddress` - The address of the Pyth smart contract.
  - `bytes32 priceFeedId` - The ID of the price feed to query.
  - `bool useEma` - Use the exponentially-weighted moving average price rather than the latest price.
- Expected Parents: 0

### Reducer Node

The Reducer Node combines the data from multiple parents using the specified operation.

- `nodeType` Value: 1
- Parameters:
  - `uint256 operation` - The type of operation to use when combining the parent's data.
    - 0 - `RECENT`: Return the data of the parent that has the greatest timestamp.
    - 1 - `MIN`: Return the data of the parent with the lowest price.
    - 2 - `MAX`: Return the data of the parent with the highest price.
    - 3 - `MEAN`: Return the mean average of all the values in the parents' data.
    - 4 - `MEDIAN`: Return the data of the parent that has the median price. (notice: this operation will return the average of the two most middle nodes when the length of the array is even)
    - 5 - `MUL`: Return the price of the parents after multiplying them. The timestamp is averaged.
    - 6 - `DIV`: Return the price of the parents after dividing them. The timestamp is averaged.
- Expected Parents: >1

### Price Deviation Circuit Breaker Node

The Price Deviation Circuit Breaker Node passes through value of the first parent if the prices between the first two parents are within the deviation tolerance. Otherwise, it returns the third parent if specified or reverts with `DeviationToleranceExceeded`. _Note that the third parent will be returned regardless of its price. If this is a concern, the third parent should be another Price Deviation Circuit Breaker._

- `nodeType` Value: 6
- Parameters:
  - `uint256 deviationTolerance` - The percentage difference (denominated with 18 decimals) between the two parents' prices over which the node will provide the fallback parent node's data or revert.
- Expected Parents: 2-3

### Staleness Circuit Breaker Node

The Staleness Circuit Breaker Node passes through the value of the first parent if the timestamp associated with it is within the staleness tolerance. Otherwise, it returns the second parent if specified or reverts with `StalenessToleranceExceeded`. _Note that the second parent will be returned regardless of its staleness. If this is a concern, the second parent should be another Staleness Circuit Breaker._

- `nodeType` Value: 7
- Parameters:
  - `uint256 stalenessTolerance` - The number of seconds in the past that determines whether the first parent's data is considered stale. If it's stale, the node will provide the fallback parents node's data or revert. This value will be overriden if a value for `stalenessTolerance` is present in the runtime.
- Expected Parents: 1-2

### Constant Node

The Constant Node returns a value for its price, set on registrations. It returns `block.timestamp` for the timestamp. This is useful for test scenarios and in conjunction with the Reducer Node in production. This should _not_ be used instead of an oracle for pegged assets.

- `nodeType` Value: 8
- Parameters:
  - `int256 price` - The price for this node to return when processed.
- Expected Parents: 0

### External Node

The External Node allows a custom node to be defined in an smart contract at a specified address. This contract must conform to the [`IExternalNode` interface](./contracts/interfaces/external/IExternalNode.sol). Note that additional data can be appended to the parameters (following `nodeAddress`) and leveraged by an external node implementation.

- `nodeType` Value: 2
- Parameters:
  - `address nodeAddress` - The address of the external node contract.
- Expected Parents: N/A (_Determined by the custom node implementation._)

Find some [external node implementations here](https://github.com/synthetixio/external-nodes).

## Development

To run the oracle manager (after running `yarn && yarn build` in the project root):

`yarn hardhat cannon:build && yarn hardhat cannon:run`

To run the tests:

`yarn test`

### New Node Type Checklist

1.  Add the new node type to NodeType enum in `/storage/NodeDefinition.sol`.
2.  Add a new library in `/nodes`. It must have the following function interface:
    ` function process(NodeOutput.Data[] memory prices, bytes memory parameters) internal view returns (NodeOutput.Data memory)`
3.  Add the new node type into `_validateNodeType()` in `/modules/NodeModule.sol`
4.  Add a condition for new node type in `_process` in `modules/NodeModule.sol` that calls the node library from step 2.
5.  Add appropriate tests and documentation.
