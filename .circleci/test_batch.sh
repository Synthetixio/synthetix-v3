execute_batch () {
  BATCH_INDEX=$1
  shift
  BATCH=("${@}")
  echo "Running batch $BATCH_INDEX..."
  for ATTEMPT in {1..3}; do
    echo "Running attempt $ATTEMPT..."
    echo mocha --jobs 1 --retries 0 --timeout 10000 --require hardhat/register --exit "${BATCH[@]}"
    mocha --jobs 1 --retries 0 --timeout 10000 --require hardhat/register --exit "${BATCH[@]}" && {
      echo "Batch $BATCH_INDEX passed."
      return 0
    } || {
      echo "Batch $BATCH_INDEX failed... Retrying attempt $ATTEMPT..."
      sleep 1
      if [ $ATTEMPT -eq 3 ]; then
        return 1
      fi
    }
    echo
    echo
    echo
    echo
    echo
    echo
    echo
    echo
  done
}

BATCH_INDEX=0
BATCH=()
echo "$TEST_FILES" | tr ' ' '\n' | while read -r TEST; do
  BATCH+=("$TEST")
  if [ ${#BATCH[@]} -eq 5 ]; then
    execute_batch $BATCH_INDEX "${BATCH[@]}"
    BATCH=()
    ((BATCH_INDEX++))
  fi
done

if [ ${#BATCH[@]} -ne 0 ]; then
  echo "Running batch $BATCH_INDEX..."
  execute_batch $BATCH_INDEX "${BATCH[@]}"
fi
