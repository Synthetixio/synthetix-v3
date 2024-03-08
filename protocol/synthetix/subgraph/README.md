# Synthetix v3 Subgraph

**NOTE**: Subgraph code is generated from the CoreProxy ABI on optimism-goerli. We rely on all deployments for all networks to be at least compatible. As soon as we start diverging and different networks will have different behaviour (relevant to the subgraph) we would need to separate subgraph processing for the divergent network.

See in [subgraph.base.yaml](subgraph.base.yaml) the `source` field for the `CoreProxy` contract. This is the contract that is used to generate the subgraph code.

```yaml
abis:
  - name: CoreProxy
    file: ./optimism-goerli/deployments/system/CoreProxy.json
```

## Updating the subgraph

```bash
# 1. fetch the latest deployments for all the supported networks
yarn deployments

# 2. generate the networks.json file
yarn subgraphgen
```

## Testing the subgraph

```bash
yarn test
```

### Deploying subgraph for each network

```bash
# 1. Ensure you have $V3_GRAPH_KEY ENV variable set and authorise graph-cli
yarn auth

# 2. Make sure graph is built
yarn build:optimism-goerli

# 3. Deploy the subgraph
yarn deploy:optimism-goerli

# 4. Repeat for other networks:
yarn build:optimism-mainnet
yarn deploy:optimism-mainnet
yarn build:goerli
yarn deploy:goerli
yarn build:mainnet
yarn deploy:mainnet
```
