#!/bin/bash

set -x
set -e

snx_package=$1

for toml in tomls/*.toml; do
    npx cannon build $toml snx_package=$1
done