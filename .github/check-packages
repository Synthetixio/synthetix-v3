#!/bin/sh

# Check that package-lock.json file does not exist on any package of the workspace
for workspace in $(find packages/* -type d -maxdepth 0)
do
  lockfile="$workspace/package-lock.json"
  if [ -f "$lockfile" ]; then
    echo "The file $lockfile was found, please delete it and install dependencies using npm's Workspaces functionality"
    echo ' - More info 👉 https://docs.npmjs.com/cli/v7/using-npm/workspaces'
    exit 1
  fi
done
