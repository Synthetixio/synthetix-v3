# Solidity API

## Council Token Module

### isInitialized

  ```solidity
  function isInitialized() external returns (bool)
  ```

  Returns whether the token has been initialized.

**Returns**
* `[0]` (*bool*) - A boolean with the result of the query.
### initialize

  ```solidity
  function initialize(string tokenName, string tokenSymbol, string uri) external
  ```

  Initializes the token with name, symbol, and uri.

### mint

  ```solidity
  function mint(address to, uint256 tokenId) external
  ```

  Allows the owner to mint tokens.

**Parameters**
* `to` (*address*) - The address to receive the newly minted tokens.
* `tokenId` (*uint256*) - The ID of the newly minted token

### safeMint

  ```solidity
  function safeMint(address to, uint256 tokenId, bytes data) external
  ```

  Allows the owner to mint tokens. Verifies that the receiver can receive the token

**Parameters**
* `to` (*address*) - The address to receive the newly minted token.
* `tokenId` (*uint256*) - The ID of the newly minted token
* `data` (*bytes*) - any data which should be sent to the receiver

### burn

  ```solidity
  function burn(uint256 tokenId) external
  ```

  Allows the owner to burn tokens.

**Parameters**
* `tokenId` (*uint256*) - The token to burn

### setAllowance

  ```solidity
  function setAllowance(uint256 tokenId, address spender) external
  ```

  Allows an address that holds tokens to provide allowance to another.

**Parameters**
* `tokenId` (*uint256*) - The token which should be allowed to spender
* `spender` (*address*) - The address that is given allowance.

### setBaseTokenURI

  ```solidity
  function setBaseTokenURI(string uri) external
  ```

  Allows the owner to update the base token URI.

**Parameters**
* `uri` (*string*) - The new base token uri

### totalSupply

  ```solidity
  function totalSupply() external view returns (uint256)
  ```

  Returns the total amount of tokens stored by the contract.

### tokenOfOwnerByIndex

  ```solidity
  function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)
  ```

  Returns a token ID owned by `owner` at a given `index` of its token list.
Use along with {balanceOf} to enumerate all of ``owner``'s tokens.

Requirements:
- `owner` must be a valid address
- `index` must be less than the balance of the tokens for the owner

### tokenByIndex

  ```solidity
  function tokenByIndex(uint256 index) external view returns (uint256)
  ```

  Returns a token ID at a given `index` of all the tokens stored by the contract.
Use along with {totalSupply} to enumerate all tokens.

Requirements:
- `index` must be less than the total supply of the tokens

### balanceOf

  ```solidity
  function balanceOf(address holder) external view returns (uint256 balance)
  ```

  Returns the number of tokens in ``owner``'s account.

Requirements:

- `holder` must be a valid address

### ownerOf

  ```solidity
  function ownerOf(uint256 tokenId) external view returns (address owner)
  ```

  Returns the owner of the `tokenId` token.

Requirements:

- `tokenId` must exist.

### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external
  ```

  Safely transfers `tokenId` token from `from` to `to`.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event.

### safeTransferFrom

  ```solidity
  function safeTransferFrom(address from, address to, uint256 tokenId) external
  ```

  Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
are aware of the ERC721 protocol to prevent tokens from being forever locked.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must exist and be owned by `from`.
- If the caller is not `from`, it must have been allowed to move this token by either {approve} or {setApprovalForAll}.
- If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.

Emits a {Transfer} event.

### transferFrom

  ```solidity
  function transferFrom(address from, address to, uint256 tokenId) external
  ```

  Transfers `tokenId` token from `from` to `to`.

WARNING: Usage of this method is discouraged, use {safeTransferFrom} whenever possible.

Requirements:

- `from` cannot be the zero address.
- `to` cannot be the zero address.
- `tokenId` token must be owned by `from`.
- If the caller is not `from`, it must be approved to move this token by either {approve} or {setApprovalForAll}.

Emits a {Transfer} event.

### approve

  ```solidity
  function approve(address to, uint256 tokenId) external
  ```

  Gives permission to `to` to transfer `tokenId` token to another account.
The approval is cleared when the token is transferred.

Only a single account can be approved at a time, so approving the zero address clears previous approvals.

Requirements:

- The caller must own the token or be an approved operator.
- `tokenId` must exist.

Emits an {Approval} event.

### setApprovalForAll

  ```solidity
  function setApprovalForAll(address operator, bool approved) external
  ```

  Approve or remove `operator` as an operator for the caller.
Operators can call {transferFrom} or {safeTransferFrom} for any token owned by the caller.

Requirements:

- The `operator` cannot be the caller.

Emits an {ApprovalForAll} event.

### getApproved

  ```solidity
  function getApproved(uint256 tokenId) external view returns (address operator)
  ```

  Returns the account approved for `tokenId` token.

Requirements:

- `tokenId` must exist.

### isApprovedForAll

  ```solidity
  function isApprovedForAll(address owner, address operator) external view returns (bool)
  ```

  Returns if the `operator` is allowed to manage all of the assets of `owner`.

See {setApprovalForAll}

### Transfer

  ```solidity
  event Transfer(address from, address to, uint256 tokenId)
  ```

  Emitted when `tokenId` token is transferred from `from` to `to`.

### Approval

  ```solidity
  event Approval(address owner, address approved, uint256 tokenId)
  ```

  Emitted when `owner` enables `approved` to manage the `tokenId` token.

### ApprovalForAll

  ```solidity
  event ApprovalForAll(address owner, address operator, bool approved)
  ```

  Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.

## IDebtShare

### balanceOfOnPeriod

  ```solidity
  function balanceOfOnPeriod(address account, uint256 periodId) external view returns (uint256)
  ```

## Election Inspector Module

### getEpochStartDateForIndex

  ```solidity
  function getEpochStartDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the given epoch started

### getEpochEndDateForIndex

  ```solidity
  function getEpochEndDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the given epoch ended

### getNominationPeriodStartDateForIndex

  ```solidity
  function getNominationPeriodStartDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the Nomination period in the given epoch started

### getVotingPeriodStartDateForIndex

  ```solidity
  function getVotingPeriodStartDateForIndex(uint256 epochIndex) external view returns (uint64)
  ```

  Returns the date in which the Voting period in the given epoch started

### wasNominated

  ```solidity
  function wasNominated(address candidate, uint256 epochIndex) external view returns (bool)
  ```

  Shows if a candidate was nominated in the given epoch

### getNomineesAtEpoch

  ```solidity
  function getNomineesAtEpoch(uint256 epochIndex) external view returns (address[])
  ```

  Returns a list of all nominated candidates in the given epoch

### getBallotVotedAtEpoch

  ```solidity
  function getBallotVotedAtEpoch(address user, uint256 epochIndex) external view returns (bytes32)
  ```

  Returns the ballot id that user voted on in the given election

### hasVotedInEpoch

  ```solidity
  function hasVotedInEpoch(address user, uint256 epochIndex) external view returns (bool)
  ```

  Returns if user has voted in the given election

### getBallotVotesInEpoch

  ```solidity
  function getBallotVotesInEpoch(bytes32 ballotId, uint256 epochIndex) external view returns (uint256)
  ```

  Returns the number of votes given to a particular ballot in a given epoch

### getBallotCandidatesInEpoch

  ```solidity
  function getBallotCandidatesInEpoch(bytes32 ballotId, uint256 epochIndex) external view returns (address[])
  ```

  Returns the list of candidates that a particular ballot has in a given epoch

### getCandidateVotesInEpoch

  ```solidity
  function getCandidateVotesInEpoch(address candidate, uint256 epochIndex) external view returns (uint256)
  ```

  Returns the number of votes a candidate received in a given epoch

### getElectionWinnersInEpoch

  ```solidity
  function getElectionWinnersInEpoch(uint256 epochIndex) external view returns (address[])
  ```

  Returns the winners of the given election

## Election Module

### initOrUpgradeElectionModule

  ```solidity
  function initOrUpgradeElectionModule(address[] firstCouncil, uint8 minimumActiveMembers, uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate) external
  ```

  Initializes the module and immediately starts the first epoch

### isElectionModuleInitialized

  ```solidity
  function isElectionModuleInitialized() external view returns (bool)
  ```

  Shows whether the module has been initialized

### tweakEpochSchedule

  ```solidity
  function tweakEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration, and that changes are small (see setMaxDateAdjustmentTolerance)

### modifyEpochSchedule

  ```solidity
  function modifyEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration

### setMinEpochDurations

  ```solidity
  function setMinEpochDurations(uint64 newMinNominationPeriodDuration, uint64 newMinVotingPeriodDuration, uint64 newMinEpochDuration) external
  ```

  Determines minimum values for epoch schedule adjustments

### setMaxDateAdjustmentTolerance

  ```solidity
  function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external
  ```

  Determines adjustment size for tweakEpochSchedule

### setDefaultBallotEvaluationBatchSize

  ```solidity
  function setDefaultBallotEvaluationBatchSize(uint256 newDefaultBallotEvaluationBatchSize) external
  ```

  Determines batch size when evaluate() is called with numBallots = 0

### setNextEpochSeatCount

  ```solidity
  function setNextEpochSeatCount(uint8 newSeatCount) external
  ```

  Determines the number of council members in the next epoch

### setMinimumActiveMembers

  ```solidity
  function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external
  ```

  Determines the minimum number of council members before triggering an emergency election

### dismissMembers

  ```solidity
  function dismissMembers(address[] members) external
  ```

  Allows the owner to remove one or more council members, triggering an election if a threshold is met

### nominate

  ```solidity
  function nominate() external
  ```

  Allows anyone to self-nominate during the Nomination period

### withdrawNomination

  ```solidity
  function withdrawNomination() external
  ```

  Self-withdrawal of nominations during the Nomination period

### cast

  ```solidity
  function cast(address[] candidates) external
  ```

  Allows anyone with vote power to vote on nominated candidates during the Voting period

### withdrawVote

  ```solidity
  function withdrawVote() external
  ```

  Allows votes to be withdraw

### evaluate

  ```solidity
  function evaluate(uint256 numBallots) external
  ```

  Processes ballots in batches during the Evaluation period (after epochEndDate)

### resolve

  ```solidity
  function resolve() external
  ```

  Shuffles NFTs and resolves an election after it has been evaluated

### getMinEpochDurations

  ```solidity
  function getMinEpochDurations() external view returns (uint64 minNominationPeriodDuration, uint64 minVotingPeriodDuration, uint64 minEpochDuration)
  ```

  Exposes minimum durations required when adjusting epoch schedules

### getMaxDateAdjustmenTolerance

  ```solidity
  function getMaxDateAdjustmenTolerance() external view returns (uint64)
  ```

  Exposes maximum size of adjustments when calling tweakEpochSchedule

### getDefaultBallotEvaluationBatchSize

  ```solidity
  function getDefaultBallotEvaluationBatchSize() external view returns (uint256)
  ```

  Shows the default batch size when calling evaluate() with numBallots = 0

### getNextEpochSeatCount

  ```solidity
  function getNextEpochSeatCount() external view returns (uint8)
  ```

  Shows the number of council members that the next epoch will have

### getMinimumActiveMembers

  ```solidity
  function getMinimumActiveMembers() external view returns (uint8)
  ```

  Returns the minimum active members that the council needs to avoid an emergency election

### getEpochIndex

  ```solidity
  function getEpochIndex() external view returns (uint256)
  ```

  Returns the index of the current epoch. The first epoch's index is 1

### getEpochStartDate

  ```solidity
  function getEpochStartDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch started

### getEpochEndDate

  ```solidity
  function getEpochEndDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch will end

### getNominationPeriodStartDate

  ```solidity
  function getNominationPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Nomination period in the current epoch will start

### getVotingPeriodStartDate

  ```solidity
  function getVotingPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Voting period in the current epoch will start

### getCurrentPeriod

  ```solidity
  function getCurrentPeriod() external view returns (uint256)
  ```

  Returns the current period type: Administration, Nomination, Voting, Evaluation

### isNominated

  ```solidity
  function isNominated(address candidate) external view returns (bool)
  ```

  Shows if a candidate has been nominated in the current epoch

### getNominees

  ```solidity
  function getNominees() external view returns (address[])
  ```

  Returns a list of all nominated candidates in the current epoch

### calculateBallotId

  ```solidity
  function calculateBallotId(address[] candidates) external pure returns (bytes32)
  ```

  Hashes a list of candidates (used for identifying and storing ballots)

### getBallotVoted

  ```solidity
  function getBallotVoted(address user) external view returns (bytes32)
  ```

  Returns the ballot id that user voted on in the current election

### hasVoted

  ```solidity
  function hasVoted(address user) external view returns (bool)
  ```

  Returns if user has voted in the current election

### getVotePower

  ```solidity
  function getVotePower(address user) external view returns (uint256)
  ```

  Returns the vote power of user in the current election

### getBallotVotes

  ```solidity
  function getBallotVotes(bytes32 ballotId) external view returns (uint256)
  ```

  Returns the number of votes given to a particular ballot

### getBallotCandidates

  ```solidity
  function getBallotCandidates(bytes32 ballotId) external view returns (address[])
  ```

  Returns the list of candidates that a particular ballot has

### isElectionEvaluated

  ```solidity
  function isElectionEvaluated() external view returns (bool)
  ```

  Returns whether all ballots in the current election have been counted

### getCandidateVotes

  ```solidity
  function getCandidateVotes(address candidate) external view returns (uint256)
  ```

  Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated

### getElectionWinners

  ```solidity
  function getElectionWinners() external view returns (address[])
  ```

  Returns the winners of the current election. Requires the election to be partially or totally evaluated

### getCouncilToken

  ```solidity
  function getCouncilToken() external view returns (address)
  ```

  Returns the address of the council NFT token

### getCouncilMembers

  ```solidity
  function getCouncilMembers() external view returns (address[])
  ```

  Returns the current NFT token holders

## Synthetix Election Module

### initOrUpgradeElectionModule

  ```solidity
  function initOrUpgradeElectionModule(address[] firstCouncil, uint8 minimumActiveMembers, uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate, address debtShareContract) external
  ```

  Initializes the module and immediately starts the first epoch

### setDebtShareContract

  ```solidity
  function setDebtShareContract(address newDebtShareContractAddress) external
  ```

  Sets the Synthetix v2 DebtShare contract that determines vote power

### getDebtShareContract

  ```solidity
  function getDebtShareContract() external view returns (address)
  ```

  Returns the Synthetix v2 DebtShare contract that determines vote power

### setDebtShareSnapshotId

  ```solidity
  function setDebtShareSnapshotId(uint256 snapshotId) external
  ```

  Sets the Synthetix v2 DebtShare snapshot that determines vote power for this epoch

### getDebtShareSnapshotId

  ```solidity
  function getDebtShareSnapshotId() external view returns (uint256)
  ```

  Returns the Synthetix v2 DebtShare snapshot id set for this epoch

### getDebtShare

  ```solidity
  function getDebtShare(address user) external view returns (uint256)
  ```

  Returns the Synthetix v2 debt share for the provided address, at this epoch's snapshot

### setCrossChainDebtShareMerkleRoot

  ```solidity
  function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint256 blocknumber) external
  ```

  Allows the system owner to declare a merkle root for user debt shares on other chains for this epoch

### getCrossChainDebtShareMerkleRoot

  ```solidity
  function getCrossChainDebtShareMerkleRoot() external view returns (bytes32)
  ```

  Returns the current epoch's merkle root for user debt shares on other chains

### getCrossChainDebtShareMerkleRootBlockNumber

  ```solidity
  function getCrossChainDebtShareMerkleRootBlockNumber() external view returns (uint256)
  ```

  Returns the current epoch's merkle root block number

### declareCrossChainDebtShare

  ```solidity
  function declareCrossChainDebtShare(address account, uint256 debtShare, bytes32[] merkleProof) external
  ```

  Allows users to declare their Synthetix v2 debt shares on other chains

### getDeclaredCrossChainDebtShare

  ```solidity
  function getDeclaredCrossChainDebtShare(address account) external view returns (uint256)
  ```

  Returns the Synthetix v2 debt shares for the provided address, at this epoch's snapshot, in other chains

### declareAndCast

  ```solidity
  function declareAndCast(uint256 debtShare, bytes32[] merkleProof, address[] candidates) external
  ```

  Declares cross chain debt shares and casts a vote

### initOrUpgradeElectionModule

  ```solidity
  function initOrUpgradeElectionModule(address[] firstCouncil, uint8 minimumActiveMembers, uint64 nominationPeriodStartDate, uint64 votingPeriodStartDate, uint64 epochEndDate) external
  ```

  Initializes the module and immediately starts the first epoch

### isElectionModuleInitialized

  ```solidity
  function isElectionModuleInitialized() external view returns (bool)
  ```

  Shows whether the module has been initialized

### tweakEpochSchedule

  ```solidity
  function tweakEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration, and that changes are small (see setMaxDateAdjustmentTolerance)

### modifyEpochSchedule

  ```solidity
  function modifyEpochSchedule(uint64 newNominationPeriodStartDate, uint64 newVotingPeriodStartDate, uint64 newEpochEndDate) external
  ```

  Adjusts the current epoch schedule requiring that the current period remains Administration

### setMinEpochDurations

  ```solidity
  function setMinEpochDurations(uint64 newMinNominationPeriodDuration, uint64 newMinVotingPeriodDuration, uint64 newMinEpochDuration) external
  ```

  Determines minimum values for epoch schedule adjustments

### setMaxDateAdjustmentTolerance

  ```solidity
  function setMaxDateAdjustmentTolerance(uint64 newMaxDateAdjustmentTolerance) external
  ```

  Determines adjustment size for tweakEpochSchedule

### setDefaultBallotEvaluationBatchSize

  ```solidity
  function setDefaultBallotEvaluationBatchSize(uint256 newDefaultBallotEvaluationBatchSize) external
  ```

  Determines batch size when evaluate() is called with numBallots = 0

### setNextEpochSeatCount

  ```solidity
  function setNextEpochSeatCount(uint8 newSeatCount) external
  ```

  Determines the number of council members in the next epoch

### setMinimumActiveMembers

  ```solidity
  function setMinimumActiveMembers(uint8 newMinimumActiveMembers) external
  ```

  Determines the minimum number of council members before triggering an emergency election

### dismissMembers

  ```solidity
  function dismissMembers(address[] members) external
  ```

  Allows the owner to remove one or more council members, triggering an election if a threshold is met

### nominate

  ```solidity
  function nominate() external
  ```

  Allows anyone to self-nominate during the Nomination period

### withdrawNomination

  ```solidity
  function withdrawNomination() external
  ```

  Self-withdrawal of nominations during the Nomination period

### cast

  ```solidity
  function cast(address[] candidates) external
  ```

  Allows anyone with vote power to vote on nominated candidates during the Voting period

### withdrawVote

  ```solidity
  function withdrawVote() external
  ```

  Allows votes to be withdraw

### evaluate

  ```solidity
  function evaluate(uint256 numBallots) external
  ```

  Processes ballots in batches during the Evaluation period (after epochEndDate)

### resolve

  ```solidity
  function resolve() external
  ```

  Shuffles NFTs and resolves an election after it has been evaluated

### getMinEpochDurations

  ```solidity
  function getMinEpochDurations() external view returns (uint64 minNominationPeriodDuration, uint64 minVotingPeriodDuration, uint64 minEpochDuration)
  ```

  Exposes minimum durations required when adjusting epoch schedules

### getMaxDateAdjustmenTolerance

  ```solidity
  function getMaxDateAdjustmenTolerance() external view returns (uint64)
  ```

  Exposes maximum size of adjustments when calling tweakEpochSchedule

### getDefaultBallotEvaluationBatchSize

  ```solidity
  function getDefaultBallotEvaluationBatchSize() external view returns (uint256)
  ```

  Shows the default batch size when calling evaluate() with numBallots = 0

### getNextEpochSeatCount

  ```solidity
  function getNextEpochSeatCount() external view returns (uint8)
  ```

  Shows the number of council members that the next epoch will have

### getMinimumActiveMembers

  ```solidity
  function getMinimumActiveMembers() external view returns (uint8)
  ```

  Returns the minimum active members that the council needs to avoid an emergency election

### getEpochIndex

  ```solidity
  function getEpochIndex() external view returns (uint256)
  ```

  Returns the index of the current epoch. The first epoch's index is 1

### getEpochStartDate

  ```solidity
  function getEpochStartDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch started

### getEpochEndDate

  ```solidity
  function getEpochEndDate() external view returns (uint64)
  ```

  Returns the date in which the current epoch will end

### getNominationPeriodStartDate

  ```solidity
  function getNominationPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Nomination period in the current epoch will start

### getVotingPeriodStartDate

  ```solidity
  function getVotingPeriodStartDate() external view returns (uint64)
  ```

  Returns the date in which the Voting period in the current epoch will start

### getCurrentPeriod

  ```solidity
  function getCurrentPeriod() external view returns (uint256)
  ```

  Returns the current period type: Administration, Nomination, Voting, Evaluation

### isNominated

  ```solidity
  function isNominated(address candidate) external view returns (bool)
  ```

  Shows if a candidate has been nominated in the current epoch

### getNominees

  ```solidity
  function getNominees() external view returns (address[])
  ```

  Returns a list of all nominated candidates in the current epoch

### calculateBallotId

  ```solidity
  function calculateBallotId(address[] candidates) external pure returns (bytes32)
  ```

  Hashes a list of candidates (used for identifying and storing ballots)

### getBallotVoted

  ```solidity
  function getBallotVoted(address user) external view returns (bytes32)
  ```

  Returns the ballot id that user voted on in the current election

### hasVoted

  ```solidity
  function hasVoted(address user) external view returns (bool)
  ```

  Returns if user has voted in the current election

### getVotePower

  ```solidity
  function getVotePower(address user) external view returns (uint256)
  ```

  Returns the vote power of user in the current election

### getBallotVotes

  ```solidity
  function getBallotVotes(bytes32 ballotId) external view returns (uint256)
  ```

  Returns the number of votes given to a particular ballot

### getBallotCandidates

  ```solidity
  function getBallotCandidates(bytes32 ballotId) external view returns (address[])
  ```

  Returns the list of candidates that a particular ballot has

### isElectionEvaluated

  ```solidity
  function isElectionEvaluated() external view returns (bool)
  ```

  Returns whether all ballots in the current election have been counted

### getCandidateVotes

  ```solidity
  function getCandidateVotes(address candidate) external view returns (uint256)
  ```

  Returns the number of votes a candidate received. Requires the election to be partially or totally evaluated

### getElectionWinners

  ```solidity
  function getElectionWinners() external view returns (address[])
  ```

  Returns the winners of the current election. Requires the election to be partially or totally evaluated

### getCouncilToken

  ```solidity
  function getCouncilToken() external view returns (address)
  ```

  Returns the address of the council NFT token

### getCouncilMembers

  ```solidity
  function getCouncilMembers() external view returns (address[])
  ```

  Returns the current NFT token holders

