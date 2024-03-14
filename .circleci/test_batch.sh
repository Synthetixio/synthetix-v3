padding () {
  echo
  echo
  echo
  echo
  echo '---------------------------------------------------------------------------------------'
  echo
  echo
  echo
  echo
}

execute_batch () {
  BATCH_INDEX=$1
  shift
  BATCH=("${@}")
  echo "Running batch $BATCH_INDEX..."
  for ATTEMPT in {1..3}; do
    echo "Running attempt $ATTEMPT..."
    echo mocha --jobs 1 --retries 2 --timeout 20000 --require hardhat/register --exit "${BATCH[@]}"
    mocha --jobs 1 --retries 2 --timeout 20000 --require hardhat/register --exit "${BATCH[@]}" && {
      echo "Batch $BATCH_INDEX passed."
      padding
      return 0
    } || {
      echo "Batch $BATCH_INDEX failed... Retrying attempt $ATTEMPT..."
      sleep 1
      if [ $ATTEMPT -eq 3 ]; then
        padding
        return 1
      fi
    }
    padding
  done
}

BATCH_INDEX=0
BATCH=()
echo "$TEST_FILES" | tr ' ' '\n' | while read -r TEST; do
  BATCH+=("$TEST")
  if [ ${#BATCH[@]} -eq 1 ]; then
    execute_batch $BATCH_INDEX "${BATCH[@]}"
    BATCH=()
    ((BATCH_INDEX++))
  fi
done

if [ ${#BATCH[@]} -ne 0 ]; then
  echo "Running batch $BATCH_INDEX..."
  execute_batch $BATCH_INDEX "${BATCH[@]}"
fi
