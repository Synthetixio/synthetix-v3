//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ElectionModule as BaseElectionModule} from "@synthetixio/core-modules/contracts/modules/ElectionModule.sol";
import "@synthetixio/core-contracts/contracts/utils/MathUtil.sol";
import "@synthetixio/core-modules/contracts/interfaces/IElectionModule.sol";
import "../interfaces/ISynthetixElectionModule.sol";
import "../submodules/election/DebtShareManager.sol";
import "../submodules/election/CrossChainDebtShareManager.sol";

/// @title Module for electing a council, represented by a set of NFT holders
/// @notice This extends the base ElectionModule by determining voting power by Synthetix v2 debt shares, both on L1 and on L2.
/// @dev The L2 debt shares are read directly from a contract, and the L1 debt shares are read from a merkle tree.
/// @dev A snapshot must be set to determine the debt share id to use.
/// @dev The merkle proof must also be provided for L1 debt shares before an election.
/// @dev L1 EOA debt share holders can use declareAndCast to vote.
/// @dev L1 non-EOA debt share holders can use declareAndCastCrossChain to vote, but they need to relay the call through Optimism's messengers.
contract ElectionModule is ISynthetixElectionModule, BaseElectionModule, DebtShareManager, CrossChainDebtShareManager {
    error TooManyCandidates();
    error WrongInitializer();

    /// @dev The BaseElectionModule initializer should not be called, and this one must be called instead
    function initializeElectionModule(
        string memory,
        string memory,
        address[] memory,
        uint8,
        uint64,
        uint64,
        uint64
    ) external view override(BaseElectionModule, IElectionModule) onlyOwner onlyIfNotInitialized {
        revert WrongInitializer();
    }

    /// @dev Overloads the BaseElectionModule initializer with an additional parameter for the debt share contract
    function initializeElectionModule(
        string memory councilTokenName,
        string memory councilTokenSymbol,
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address debtShareContract
    ) external override onlyOwner onlyIfNotInitialized {
        _setDebtShareContract(debtShareContract);

        _initializeElectionModule(
            councilTokenName,
            councilTokenSymbol,
            firstCouncil,
            minimumActiveMembers,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    /// @dev Overrides the BaseElectionModule cast function to only allow 1 candidate to be voted.
    /// @dev This function is all that needs to be called by L2 debt share holders to vote.
    function cast(address[] calldata candidates)
        public
        override(BaseElectionModule, IElectionModule)
        onlyInPeriod(ElectionPeriod.Vote)
    {
        if (candidates.length > 1) {
            revert TooManyCandidates();
        }

        _cast(msg.sender, candidates);
    }

    // ---------------------------------------
    // Debt shares
    // ---------------------------------------

    function setDebtShareContract(address debtShareContract)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Administration)
    {
        _setDebtShareContract(debtShareContract);

        emit DebtShareContractSet(debtShareContract);
    }

    function getDebtShareContract() external view override returns (address) {
        return address(_debtShareStore().debtShareContract);
    }

    function setDebtShareSnapshotId(uint snapshotId) external override onlyOwner onlyInPeriod(ElectionPeriod.Nomination) {
        _setDebtShareSnapshotId(snapshotId);
    }

    function getDebtShareSnapshotId() external view override returns (uint) {
        return _getDebtShareSnapshotId();
    }

    function getDebtShare(address user) external view override returns (uint) {
        return _getDebtShare(user);
    }

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    function setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber)
        external
        override
        onlyOwner
        onlyInPeriod(ElectionPeriod.Nomination)
    {
        _setCrossChainDebtShareMerkleRoot(merkleRoot, blocknumber);

        emit CrossChainDebtShareMerkleRootSet(merkleRoot, blocknumber, _getCurrentEpochIndex());
    }

    function getCrossChainDebtShareMerkleRoot() external view override returns (bytes32) {
        return _getCrossChainDebtShareMerkleRoot();
    }

    function getCrossChainDebtShareMerkleRootBlockNumber() external view override returns (uint) {
        return _getCrossChainDebtShareMerkleRootBlockNumber();
    }

    function declareCrossChainDebtShare(
        address user,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) public override onlyInPeriod(ElectionPeriod.Vote) {
        _declareCrossChainDebtShare(user, debtShare, merkleProof);

        emit CrossChainDebtShareDeclared(user, debtShare);
    }

    /// @dev L1 EOA debt share holders need to call this function before calling cast, or can call declareAndCast to avoid having to make two calls.
    function getDeclaredCrossChainDebtShare(address user) external view override returns (uint) {
        return _getDeclaredCrossChainDebtShare(user);
    }

    /// @dev L1 EOA debt share holders can call this single function to vote.
    function declareAndCast(
        uint256 debtShare,
        bytes32[] calldata merkleProof,
        address[] calldata candidates
    ) public override onlyInPeriod(ElectionPeriod.Vote) {
        declareCrossChainDebtShare(msg.sender, debtShare, merkleProof);

        cast(candidates);
    }

    function setCrossDomainMessenger(address messenger) external onlyOwner {
        _setCrossDomainMessenger(messenger);

        emit CrossDomainMessengerSet(messenger);
    }

    function getCrossDomainMessenger() external view returns (address) {
        return _getCrossDomainMessenger();
    }

    /// @dev L1 non-EOA debt share holders can use Optimism cross chain messengers to initiate a message on L1, and finalize it in this function to vote.
    /// @dev Call Proxy__OVM_L1CrossDomainMessenger 0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1 on L1 with ICrossDomainMessenger.sendMessage(<council-address-on-L1>, abi.encodeWithSignature("declareAndCastRelayed(address,uint256,bytes32[],address[])", user, debtShare, merkleProof, candidates)), 1000000).
    function declareAndCastRelayed(
        address user,
        uint256 debtShare,
        bytes32[] calldata merkleProof,
        address[] calldata candidates
    ) public override onlyInPeriod(ElectionPeriod.Vote) {
        if (candidates.length > 1) {
            revert TooManyCandidates();
        }

        // Reverts if msg.sender is not the Optimism messenger on L2,
        // or if the initiator on L1 is not the user that is voting.
        _validateCrossChainMessage(user);

        declareCrossChainDebtShare(user, debtShare, merkleProof);

        _cast(user, candidates);
    }

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    /// @dev Overrides the user's voting power by combining local chain debt share with debt shares in other chains, quadratically filtered
    function _getVotePower(address user) internal view virtual override returns (uint) {
        uint votePower = _getDebtShare(user) + _getDeclaredCrossChainDebtShare(user);

        return MathUtil.sqrt(votePower);
    }

    function _createNewEpoch() internal virtual override {
        super._createNewEpoch();

        DebtShareStore storage store = _debtShareStore();

        store.debtShareIds.push();
        store.crossChainDebtShareData.push();
    }
}
