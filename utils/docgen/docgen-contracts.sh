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

echo "## Spot Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/spot-market/docs/index.md >> $OUT

echo "## Perps Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/perps-market/docs/index.md >> $OUT

echo "## Legacy Market" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/legacy-market/docs/index.md >> $OUT

echo "## Governance" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/governance/docs/index.md >> $OUT

echo "## Oracle Manager" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/oracle-manager/docs/index.md >> $OUT

echo "OK Docgen contracts"
