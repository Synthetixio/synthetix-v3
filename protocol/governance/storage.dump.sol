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

// @custom:artifact @synthetixio/core-contracts/contracts/utils/ERC2771Context.sol:ERC2771Context
library ERC2771Context {
    address private constant TRUSTED_FORWARDER = 0xE2C5658cC5C448B48141168f3e475dF8f65A1e3e;
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
        mapping(bytes32 => uint256) _positions;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/interfaces/IWormhole.sol:IWormhole
interface IWormhole {
    struct GuardianSet {
        address[] keys;
        uint32 expirationTime;
    }
    struct Signature {
        bytes32 r;
        bytes32 s;
        uint8 v;
        uint8 guardianIndex;
    }
    struct VM {
        uint8 version;
        uint32 timestamp;
        uint32 nonce;
        uint16 emitterChainId;
        bytes32 emitterAddress;
        uint64 sequence;
        uint8 consistencyLevel;
        bytes payload;
        uint32 guardianSetIndex;
        Signature[] signatures;
        bytes32 hash;
    }
    struct ContractUpgrade {
        bytes32 module;
        uint8 action;
        uint16 chain;
        address newContract;
    }
    struct GuardianSetUpgrade {
        bytes32 module;
        uint8 action;
        uint16 chain;
        GuardianSet newGuardianSet;
        uint32 newGuardianSetIndex;
    }
    struct SetMessageFee {
        bytes32 module;
        uint8 action;
        uint16 chain;
        uint256 messageFee;
    }
    struct TransferFees {
        bytes32 module;
        uint8 action;
        uint16 chain;
        uint256 amount;
        bytes32 recipient;
    }
    struct RecoverChainId {
        bytes32 module;
        uint8 action;
        uint256 evmChainId;
        uint16 newChainId;
    }
}

// @custom:artifact @synthetixio/core-modules/contracts/interfaces/IWormholeRelayer.sol:IWormholeRelayerDelivery
interface IWormholeRelayerDelivery {
    enum DeliveryStatus {
        SUCCESS,
        RECEIVER_FAILURE
    }
    enum RefundStatus {
        REFUND_SENT,
        REFUND_FAIL,
        CROSS_CHAIN_REFUND_SENT,
        CROSS_CHAIN_REFUND_FAIL_PROVIDER_NOT_SUPPORTED,
        CROSS_CHAIN_REFUND_FAIL_NOT_ENOUGH,
        NO_REFUND_REQUESTED
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

// @custom:artifact @synthetixio/core-modules/contracts/storage/WormholeCrossChain.sol:WormholeCrossChain
library WormholeCrossChain {
    bytes32 private constant _SLOT_WORMHOLE_CROSS_CHAIN = keccak256(abi.encode("io.synthetix.core-modules.WormholeCrossChain"));
    struct Data {
        address wormholeCore;
        address wormholeRelayer;
        uint256 gasLimit;
        SetUtil.UintSet supportedNetworks;
        mapping(uint16 => bytes32) registeredEmitters;
        mapping(bytes32 => bool) hasProcessedMessage;
    }
    function load() internal pure returns (Data storage crossChain) {
        bytes32 s = _SLOT_WORMHOLE_CROSS_CHAIN;
        assembly {
            crossChain.slot := s
        }
    }
}

// @custom:artifact contracts/modules/core/ElectionModule.sol:ElectionModule
contract ElectionModule {
    uint8 private constant _MAX_BALLOT_SIZE = 1;
}

// @custom:artifact contracts/modules/core/ElectionModuleSatellite.sol:ElectionModuleSatellite
contract ElectionModuleSatellite {
    uint64 internal constant _MOTHERSHIP_CHAIN_ID = 0;
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
    }
    function load() internal pure returns (Data storage store) {
        bytes32 s = _STORAGE_SLOT;
        assembly {
            store.slot := s
        }
    }
}

// @custom:artifact contracts/storage/CrossChainDebtShare.sol:CrossChainDebtShare
library CrossChainDebtShare {
    struct Data {
        bytes32 merkleRoot;
        uint256 merkleRootBlockNumber;
        mapping(address => uint256) debtShares;
    }
}

// @custom:artifact contracts/storage/Election.sol:Election
library Election {
    struct Data {
        bool evaluated;
        uint256 numEvaluatedBallots;
        SetUtil.AddressSet nominees;
        SetUtil.AddressSet winners;
        SetUtil.Bytes32Set ballotPtrs;
        mapping(address => uint256) candidateVoteTotals;
    }
    function load(uint256 epochIndex) internal pure returns (Data storage election) {
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
    function load(uint256 epochIndex) internal pure returns (Data storage settings) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.ElectionSettings", epochIndex));
        assembly {
            settings.slot := s
        }
    }
}

// @custom:artifact contracts/storage/Epoch.sol:Epoch
library Epoch {
    enum ElectionPeriod {
        Administration,
        Nomination,
        Vote,
        Evaluation
    }
    struct Data {
        uint64 startDate;
        uint64 nominationPeriodStartDate;
        uint64 votingPeriodStartDate;
        uint64 endDate;
    }
    function load(uint256 epochIndex) internal pure returns (Data storage epoch) {
        bytes32 s = keccak256(abi.encode("io.synthetix.governance.Epoch", epochIndex));
        assembly {
            epoch.slot := s
        }
    }
}

// @custom:artifact contracts/storage/SnapshotVotePower.sol:SnapshotVotePower
library SnapshotVotePower {
    enum WeightType {
        Sqrt,
        Linear,
        Scaled
    }
    struct Data {
        bool enabled;
        SnapshotVotePower.WeightType weight;
        uint256 scale;
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
