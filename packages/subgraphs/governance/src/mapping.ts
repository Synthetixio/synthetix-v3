import { store, BigInt } from "@graphprotocol/graph-ts";
import {
  VoteRecorded,
  VoteWithdrawn,
} from "../generated/Spartan/ElectionModule";
import { Vote, VoteResult } from "../generated/schema";
import { ONE_BI, ZERO_BI } from "./helpers";

export function handleVoteRecorded(event: VoteRecorded): void {
  let id = event.params.voter
    .toHexString()
    .concat("-")
    .concat(event.address.toHexString())
    .concat("-")
    .concat(event.params.epochIndex.toString());

  let voteRecord = new Vote(id);
  let votePower = BigInt.fromString(event.params.votePower.toString());

  voteRecord.ballotId = event.params.ballotId;
  voteRecord.epochIndex = event.params.epochIndex.toString();
  voteRecord.voter = event.params.voter.toHexString();
  voteRecord.votePower = votePower;
  voteRecord.contract = event.address.toHexString();
  voteRecord.save();

  let resultId = event.params.ballotId.toHexString();
  let result = VoteResult.load(resultId);
  if (result == null) {
    result = new VoteResult(resultId);
    result.votePower = BigInt.fromString("0");
    result.voteCount = BigInt.fromString("0");
    result.epochIndex = event.params.epochIndex.toString();
    result.contract = event.address.toHexString();
  }
  result.votePower = result.votePower.plus(votePower);
  result.voteCount = result.voteCount.plus(ONE_BI);
  result.save();
}

export function handleVoteWithdrawn(event: VoteWithdrawn): void {
  let id = event.params.voter
    .toHexString()
    .concat("-")
    .concat(event.address.toHexString())
    .concat("-")
    .concat(event.params.epochIndex.toString());

  store.remove("Vote", id);

  let resultId = event.params.ballotId.toHexString();
  let result = VoteResult.load(resultId);
  if (result !== null) {
    let votePower = BigInt.fromString(event.params.votePower.toString());
    result.votePower = result.votePower.minus(votePower);
    result.voteCount = result.voteCount.minus(ONE_BI);
    if (result.voteCount === ZERO_BI) {
      store.remove("VoteResult", resultId);
    } else {
      result.save();
    }
  }
}
