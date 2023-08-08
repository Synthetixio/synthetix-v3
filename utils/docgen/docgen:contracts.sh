#!/bin/bash

ROOT=$(yarn workspace synthetix-v3 exec pwd)
OUT="$ROOT/docs/Contracts.md"
mkdir -p $ROOT/docs
touch $OUT

echo "# Smart Contracts" > $OUT
echo "" >> $OUT

echo "- [Synthetix Core](#synthetix-core)" >> $OUT
echo "- [Spot Market](#spot-market)" >> $OUT
echo "- [Perps Market](#perps-market)" >> $OUT
echo "- [Governance](#governance)" >> $OUT
echo "- [Oracle Manager](#oracle-manager)" >> $OUT
echo "" >> $OUT


echo "## Synthetix Core" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/synthetix/docs/index.md >> $OUT

echo "## Spot Market" >> $OUT
echo "" >> $OUT
echo "- [Back to TOC](#smart-contracts)" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/spot-market/docs/index.md >> $OUT

echo "## Perps Market" >> $OUT
echo "" >> $OUT
echo "- [Back to TOC](#smart-contracts)" >> $OUT
echo "" >> $OUT
cat $ROOT/markets/perps-market/docs/index.md >> $OUT

echo "## Governance" >> $OUT
echo "" >> $OUT
echo "- [Back to TOC](#smart-contracts)" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/governance/docs/index.md >> $OUT

echo "## Oracle Manager" >> $OUT
echo "" >> $OUT
echo "- [Back to TOC](#smart-contracts)" >> $OUT
echo "" >> $OUT
cat $ROOT/protocol/oracle-manager/docs/index.md >> $OUT
