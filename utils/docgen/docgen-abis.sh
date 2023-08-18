#!/bin/bash

echo "Docgen ABIs..."

ROOT=$(yarn workspace synthetix-v3 exec pwd)
OUT="$ROOT/docs/addresses-+-abis.md"
mkdir -p $ROOT/docs
rm -rf $ROOT/docs/abis
rm -rf $OUT
touch $OUT

cat "./addresses-+-abis.md" > $OUT

cat ./docs/1.md >> $OUT
echo "" >> $OUT

cat ./docs/5.md >> $OUT
echo "" >> $OUT

cat ./docs/11155111.md >> $OUT
echo "" >> $OUT

cat ./docs/10.md >> $OUT
echo "" >> $OUT

cat ./docs/420.md >> $OUT
echo "" >> $OUT

cat ./docs/80001.md >> $OUT
echo "" >> $OUT

cat ./docs/84531.md >> $OUT
echo "" >> $OUT

cp -r ./abis $ROOT/docs/abis

echo "OK Docgen ABIs"
