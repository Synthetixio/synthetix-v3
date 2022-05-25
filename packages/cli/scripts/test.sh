set -x

# Start local chain
cd test/fixture-projects/sample-project
npx hardhat node > /dev/null 2>&1 &
sleep 10

# Deploy on local chain
npx hardhat deploy --network local --clear --quiet --no-confirm --instance test

# Run tests
cd ../../..
npx mocha
test_exit_code=$?

# Kill node
pkill node

exit "$test_exit_code"
