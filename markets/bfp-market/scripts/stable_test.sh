#!/bin/bash

function recursive_execution() {
  local dir="$1"

  for file in "$dir"/*; do
    if [ -f "$file" ]; then
      TS_NODE_SKIP_IGNORE=true hardhat test "$file"
    fi

    if [ -d "$file" ]; then
      recursive_execution "$file"
    fi
  done
}

recursive_execution ./test/integration
