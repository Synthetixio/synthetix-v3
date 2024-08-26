#!/bin/bash

set -e

echo "Docgen contracts..."

ROOT=$(yarn workspace synthetix-v3 exec pwd)
OUT="$ROOT/docs/smart-contracts.md"
mkdir -p $ROOT/docs
rm -rf $OUT
touch $OUT

echo "# Smart Contracts" > $OUT
echo "" >> $OUT

echo "## Synthetix Core" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/synthetix/docs/index.md >> $OUT

echo "## Utility Core Contracts" >> $OUT
echo "" >> $OUT
cat $ROOT/utils/core-contracts/docs/index.md >> $OUT

echo "## Utility Core Modules" >> $OUT
echo "" >> $OUT
cat $ROOT/utils/core-modules/docs/index.md >> $OUT

echo "## Spot Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/spot-market/docs/index.md >> $OUT

echo "## Perps Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/perps-market/docs/index.md >> $OUT

echo "## Legacy Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/legacy-market/docs/index.md >> $OUT

echo "## BFP Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/bfp-market/docs/index.md >> $OUT

echo "## Governance" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/governance/docs/index.md >> $OUT

echo "## Oracle Manager" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/oracle-manager/docs/index.md >> $OUT


echo "# Auxiliary Packages" >> $OUT
echo "" >> $OUT
cat $ROOT/auxiliary/ArbitrumGasPriceOracle/docs/index.md >> $OUT
cat $ROOT/auxiliary/BuybackSnx/docs/index.md >> $OUT
cat $ROOT/auxiliary/ERC4626ToAssetsRatioOracle/docs/index.md >> $OUT
cat $ROOT/auxiliary/OpGasPriceOracle/docs/index.md >> $OUT
cat $ROOT/auxiliary/PythERC7412Wrapper/docs/index.md >> $OUT
cat $ROOT/auxiliary/SpotMarketOracle/docs/index.md >> $OUT
cat $ROOT/auxiliary/WstEthToStEthRatioOracle/docs/index.md >> $OUT

echo "OK Docgen contracts"
