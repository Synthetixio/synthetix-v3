// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    bytes32 private constant _SLOT_OWNABLE_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.Ownable"));
    struct Data {
        address owner;
        address nominatedOwner;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_OWNABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/proxy/ProxyStorage.sol:ProxyStorage
contract ProxyStorage {
    bytes32 private constant _SLOT_PROXY_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.Proxy"));
    struct ProxyStore {
        address implementation;
        bool simulatingUpgrade;
    }
    function _proxyStore() internal pure returns (ProxyStore storage store) {
        bytes32 s = _SLOT_PROXY_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721EnumerableStorage.sol:ERC721EnumerableStorage
library ERC721EnumerableStorage {
    bytes32 private constant _SLOT_ERC721_ENUMERABLE_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.ERC721Enumerable"));
    struct Data {
        mapping(uint256 => uint256) ownedTokensIndex;
        mapping(uint256 => uint256) allTokensIndex;
        mapping(address => mapping(uint256 => uint256)) ownedTokens;
        uint256[] allTokens;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_ERC721_ENUMERABLE_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/token/ERC721Storage.sol:ERC721Storage
library ERC721Storage {
    bytes32 private constant _SLOT_ERC721_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.ERC721"));
    struct Data {
        string name;
        string symbol;
        string baseTokenURI;
        mapping(uint256 => address) ownerOf;
        mapping(address => uint256) balanceOf;
        mapping(uint256 => address) tokenApprovals;
        mapping(address => mapping(address => bool)) operatorApprovals;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_ERC721_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-contracts/contracts/utils/SetUtil.sol:SetUtil
library SetUtil {
    struct UintSet {
        Bytes32Set raw;
    }
    struct AddressSet {
        Bytes32Set raw;
    }
    struct Bytes32Set {
        bytes32[] _values;
        mapping(bytes32 => uint) _positions;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/modules/NftModule.sol:NftModule
contract NftModule {
    bytes32 internal constant _INITIALIZED_NAME = "NftModule";
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/AssociatedSystem.sol:AssociatedSystem
library AssociatedSystem {
    bytes32 public constant KIND_ERC20 = "erc20";
    bytes32 public constant KIND_ERC721 = "erc721";
    bytes32 public constant KIND_UNMANAGED = "unmanaged";
    struct Data {
        address proxy;
        address impl;
        bytes32 kind;
    }
    function load(bytes32 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.core-modules.AssociatedSystem", id));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/CrossChain.sol:CrossChain
library CrossChain {
    bytes32 private constant _SLOT_CROSS_CHAIN = keccak256(abi.encode("io.synthetix.core-modules.CrossChain"));
    struct Data {
        address ccipRouter;
        SetUtil.UintSet supportedNetworks;
        mapping(uint64 => uint64) ccipChainIdToSelector;
        mapping(uint64 => uint64) ccipSelectorToChainId;
    }
    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/storage/Initialized.sol:Initialized
library Initialized {
    struct Data {
        bool initialized;
    }
    function load(bytes32 id) internal pure returns (Data storage store) {
        bytes32 s = keccak256(abi.encode("io.synthetix.code-modules.Initialized", id));
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/utils/CcipClient.sol:CcipClient
library CcipClient {
    bytes4 public constant EVM_EXTRA_ARGS_V1_TAG = 0x97a657c9;
    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }
    struct Any2EVMMessage {
        bytes32 messageId;
        uint64 sourceChainSelector;
        bytes sender;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
    }
    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }
    struct EVMExtraArgsV1 {
        uint256 gasLimit;
        bool strict;
    }
}

// @custom:artifact contracts/modules/core/ElectionModule.sol:ElectionModule
contract ElectionModule {
    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;
    uint8 private constant _MAX_BALLOT_SIZE = 1;
}

// @custom:artifact contracts/modules/core/ElectionModuleSatellite.sol:ElectionModuleSatellite
contract ElectionModuleSatellite {
    uint256 private constant _CROSSCHAIN_GAS_LIMIT = 100000;
}

// @custom:artifact contracts/storage/Ballot.sol:Ballot
library Ballot {
    struct Data {
        uint256 votingPower;
        address[] votedCandidates;
        uint256[] amounts;
    }
    function load(uint256 electionId, address voter, uint256 chainId) internal pure returns (Data storage self) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.Ballot", electionId, voter, chainId));
        assembly {
            self.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Council.sol:Council
library Council {
    bytes32 private constant _SLOT_COUNCIL_STORAGE = keccak256(abi.encode("io.synthetix.governance.Council"));
    enum ElectionPeriod {
        Administration,
        Nomination,
        Vote,
        Evaluation
    }
    struct Data {
        bool initialized;
        uint256 currentElectionId;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_COUNCIL_STORAGE;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/CouncilMembers.sol:CouncilMembers
library CouncilMembers {
    bytes32 private constant _STORAGE_SLOT = keccak256(abi.encode("io.synthetix.governance.CouncilMembers"));
    struct Data {
        address councilToken;
        SetUtil.AddressSet councilMembers;
        mapping(address => uint) councilTokenIds;
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _STORAGE_SLOT;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Election.sol:Election
library Election {
    struct Data {
        Epoch.Data epoch;
        bool evaluated;
        bool resolved;
        uint numEvaluatedBallots;
        SetUtil.AddressSet nominees;
        SetUtil.AddressSet winners;
        bytes32[] ballotPtrs;
        mapping(address => uint256) candidateVoteTotals;
    }
    function load(uint epochIndex) internal pure returns (Data storage election) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.Election", epochIndex));
        assembly {
            election.slot := s
        }
    }
}

// @custom:artifact contracts/storage/ElectionSettings.sol:ElectionSettings
library ElectionSettings {
    uint64 private constant _MIN_ELECTION_PERIOD_DURATION = 1;
    struct Data {
        uint8 epochSeatCount;
        uint8 minimumActiveMembers;
        uint64 epochDuration;
        uint64 nominationPeriodDuration;
        uint64 votingPeriodDuration;
        uint64 maxDateAdjustmentTolerance;
    }
    function load(uint epochIndex) internal pure returns (Data storage settings) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.ElectionSettings", epochIndex));
        assembly {
            settings.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Epoch.sol:Epoch
library Epoch {
    struct Data {
        uint64 startDate;
        uint64 endDate;
        uint64 nominationPeriodStartDate;
        uint64 votingPeriodStartDate;
    }
}

// @custom:artifact contracts/storage/SnapshotVotePower.sol:SnapshotVotePower
library SnapshotVotePower {
    struct Data {
        uint128 validFromEpoch;
        uint128 validToEpoch;
        mapping(uint128 => SnapshotVotePowerEpoch.Data) epochs;
    }
    function load(address snapshotContract) internal pure returns (Data storage self) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.SnapshotVotePower", snapshotContract));
        assembly {
            self.slot := s
        }
    }
}

// @custom:artifact contracts/storage/SnapshotVotePowerEpoch.sol:SnapshotVotePowerEpoch
library SnapshotVotePowerEpoch {
    struct Data {
        uint128 snapshotId;
        mapping(address => uint256) recordedVotingPower;
    }
}

// @custom:artifact contracts/submodules/election/ElectionCredentials.sol:ElectionCredentials
contract ElectionCredentials {
    bytes32 internal constant _COUNCIL_NFT_SYSTEM = "councilToken";
}

// @custom:artifact contracts/submodules/election/ElectionTally.sol:ElectionTally
contract ElectionTally {
    uint16 private constant _DEFAULT_EVALUATION_BATCH_SIZE = 500;
}
