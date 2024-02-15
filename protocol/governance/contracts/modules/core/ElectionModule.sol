//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";
import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "../../interfaces/IElectionModule.sol";
import "../../interfaces/ISynthetixElectionModule.sol";
import "../../submodules/election/DebtShareManager.sol";
import "../../submodules/election/CrossChainDebtShareManager.sol";

import "./BaseElectionModule.sol";

/// @title Module for electing a council, represented by a set of NFT holders
/// @notice This extends the base ElectionModule by determining voting power by Synthetix v2 debt share
contract ElectionModule is
    ISynthetixElectionModule,
    DebtShareManager,
    CrossChainDebtShareManager,
    BaseElectionModule
{
    error TooManyCandidates();
    error WrongInitializer();

    /// @dev The BaseElectionModule initializer should not be called, and this one must be called instead
    function initOrUpgradeElectionModule(
        address[] memory,
        uint8,
        uint64,
        uint64,
        uint64
    ) external override(BaseElectionModule, IElectionModule) {
        OwnableStorage.onlyOwner();
        revert WrongInitializer();
    }

    /// @dev Overloads the BaseElectionModule initializer with an additional parameter for the debt share contract
    function initOrUpgradeElectionModule(
        address[] memory firstCouncil,
        uint8 minimumActiveMembers,
        uint64 nominationPeriodStartDate,
        uint64 votingPeriodStartDate,
        uint64 epochEndDate,
        address debtShareContract
    ) external override {
        OwnableStorage.onlyOwner();
        if (Council.load().initialized) {
            return;
        }
        _setDebtShareContract(debtShareContract);

        _initOrUpgradeElectionModule(
            firstCouncil,
            minimumActiveMembers,
            nominationPeriodStartDate,
            votingPeriodStartDate,
            epochEndDate
        );
    }

    /// @dev Overrides the BaseElectionModule nominate function to only allow 1 candidate to be nominated
    function cast(
        address[] calldata candidates
    )
        public
        override(BaseElectionModule, IElectionModule)
        onlyInPeriod(Council.ElectionPeriod.Vote)
    {
        if (candidates.length > 1) {
            revert TooManyCandidates();
        }

        super.cast(candidates);
    }

    // ---------------------------------------
    // Debt shares
    // ---------------------------------------

    function setDebtShareContract(
        address debtShareContract
    ) external override onlyInPeriod(Council.ElectionPeriod.Administration) {
        OwnableStorage.onlyOwner();

        _setDebtShareContract(debtShareContract);

        emit DebtShareContractSet(debtShareContract);
    }

    function getDebtShareContract() external view override returns (address) {
        return address(DebtShare.load().debtShareContract);
    }

    function setDebtShareSnapshotId(
        uint256 snapshotId
    ) external override onlyInPeriod(Council.ElectionPeriod.Nomination) {
        OwnableStorage.onlyOwner();
        _setDebtShareSnapshotId(snapshotId);
    }

    function getDebtShareSnapshotId() external view override returns (uint256) {
        return _getDebtShareSnapshotId();
    }

    function getDebtShare(address user) external view override returns (uint256) {
        return _getDebtShare(user);
    }

    // ---------------------------------------
    // Cross chain debt shares
    // ---------------------------------------

    function setCrossChainDebtShareMerkleRoot(
        bytes32 merkleRoot,
        uint256 blocknumber
    ) external override onlyInPeriod(Council.ElectionPeriod.Nomination) {
        OwnableStorage.onlyOwner();
        _setCrossChainDebtShareMerkleRoot(merkleRoot, blocknumber);

        emit CrossChainDebtShareMerkleRootSet(
            merkleRoot,
            blocknumber,
            Council.load().lastElectionId
        );
    }

    function getCrossChainDebtShareMerkleRoot() external view override returns (bytes32) {
        return _getCrossChainDebtShareMerkleRoot();
    }

    function getCrossChainDebtShareMerkleRootBlockNumber()
        external
        view
        override
        returns (uint256)
    {
        return _getCrossChainDebtShareMerkleRootBlockNumber();
    }

    function declareCrossChainDebtShare(
        address user,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) public override onlyInPeriod(Council.ElectionPeriod.Vote) {
        _declareCrossChainDebtShare(user, debtShare, merkleProof);

        emit CrossChainDebtShareDeclared(user, debtShare);
    }

    function getDeclaredCrossChainDebtShare(address user) external view override returns (uint256) {
        return _getDeclaredCrossChainDebtShare(user);
    }

    function declareAndCast(
        uint256 debtShare,
        bytes32[] calldata merkleProof,
        address[] calldata candidates
    ) public override onlyInPeriod(Council.ElectionPeriod.Vote) {
        declareCrossChainDebtShare(ERC2771Context._msgSender(), debtShare, merkleProof);

        cast(candidates);
    }

    // ---------------------------------------
    // Internal
    // ---------------------------------------

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    /// @dev Overrides the user's voting power by combining local chain debt share with debt shares in other chains, quadratically filtered
    function _getVotePower(address user) internal view virtual override returns (uint256) {
        uint256 votePower = _getDebtShare(user) + _getDeclaredCrossChainDebtShare(user);

        return _sqrt(votePower);
    }

    function _createNewEpoch() internal virtual {
        DebtShare.Data storage store = DebtShare.load();

        store.debtShareIds.push();
        store.crossChainDebtShareData.push();
    }
}
