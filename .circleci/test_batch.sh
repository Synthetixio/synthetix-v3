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
  for ATTEMPT in $(seq 1 ${BATCH_RETRIES:-3}); do
    echo "Running attempt $ATTEMPT..."
    echo mocha --jobs 1 --retries ${MOCHA_RETRIES:-2} --timeout 20000 --require hardhat/register --reporter mocha-junit-reporter --reporter-options mochaFile=/tmp/junit/batch-$BATCH_INDEX.xml --exit "${BATCH[@]}"
    mocha --jobs 1 --retries ${MOCHA_RETRIES:-2} --timeout 20000 --require hardhat/register --reporter mocha-junit-reporter --reporter-options mochaFile=/tmp/junit/batch-$BATCH_INDEX.xml --exit "${BATCH[@]}" && {
      echo "Batch $BATCH_INDEX passed."
      padding
      return 0
    } || {
      echo "Batch $BATCH_INDEX failed... Retrying attempt $ATTEMPT..."
      sleep 1
      if [ $ATTEMPT -eq ${BATCH_RETRIES:-3} ]; then
        padding
        return 1
      fi
    }
    padding
  done
}

echo "TEST_FILES:"
echo "$TEST_FILES" | tr ' ' '\n' | while read -r TEST; do
  echo "- $TEST"
done

BATCH_INDEX=0
BATCH=()

echo "$TEST_FILES" | tr ' ' '\n' | while read -r TEST; do
  BATCH+=("$TEST")
  if [ ${#BATCH[@]} -eq ${BATCH_SIZE:-1} ]; then
    execute_batch $BATCH_INDEX "${BATCH[@]}"
    BATCH=()
    ((BATCH_INDEX++))
  fi
done

if [ ${#BATCH[@]} -ne 0 ]; then
  echo "Running batch $BATCH_INDEX..."
  execute_batch $BATCH_INDEX "${BATCH[@]}"
fi
