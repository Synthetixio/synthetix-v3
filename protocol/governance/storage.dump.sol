// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// @custom:artifact @synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol:OwnableStorage
library OwnableStorage {
    bytes32 private constant _SLOT_OWNABLE_STORAGE = keccak256(abi.encode("io.synthetix.core-contracts.Ownable"));
    struct Data {
        bool initialized;
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

// @custom:artifact @synthetixio/core-contracts/contracts/utils/DecimalMath.sol:DecimalMath
library DecimalMath {
    uint256 public constant UNIT = 1e18;
    int256 public constant UNIT_INT = int256(UNIT);
    uint128 public constant UNIT_UINT128 = uint128(UNIT);
    int128 public constant UNIT_INT128 = int128(UNIT_INT);
    uint256 public constant UNIT_PRECISE = 1e27;
    int256 public constant UNIT_PRECISE_INT = int256(UNIT_PRECISE);
    int128 public constant UNIT_PRECISE_INT128 = int128(UNIT_PRECISE_INT);
    uint256 public constant PRECISION_FACTOR = 9;
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

// @custom:artifact contracts/storage/Ballot.sol:Ballot
library Ballot {
    struct Data {
        uint votes;
        address[] candidates;
        mapping(address => uint) votesByUser;
    }
}

// @custom:artifact contracts/storage/Council.sol:Council
library Council {
    bytes32 private constant _SLOT_COUNCIL = keccak256(abi.encode("io.synthetix.governance.council"));
    enum ElectionPeriod {
        Administration,
        Nomination,
        Vote,
        Evaluation
    }
    struct Data {
        bool initialized;
        SetUtil.AddressSet councilMembers;
        mapping(address => uint) councilTokenIds;
        uint lastElectionId;
        ElectionSettings.Data nextElectionSettings;
    }
    function load() internal pure returns (Data storage council) {
        bytes32 s = _SLOT_COUNCIL;
        assembly {
            council.slot := s
        }
    }
}

// @custom:artifact contracts/storage/CrossChainDebtShare.sol:CrossChainDebtShare
library CrossChainDebtShare {
    struct Data {
        bytes32 merkleRoot;
        uint merkleRootBlockNumber;
        mapping(address => uint) debtShares;
    }
}

// @custom:artifact contracts/storage/DebtShare.sol:DebtShare
library DebtShare {
    bytes32 private constant _SLOT_DEBT_SHARE_STORAGE = keccak256(abi.encode("io.synthetix.election-module.debtshare"));
    struct Data {
        address debtShareContract;
        uint128[] debtShareIds;
        CrossChainDebtShare.Data[] crossChainDebtShareData;
    }
    function load() internal pure returns (Data storage debtShare) {
        bytes32 s = _SLOT_DEBT_SHARE_STORAGE;
        assembly {
            debtShare.slot := s
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
        bytes32[] ballotIds;
        mapping(bytes32 => Ballot.Data) ballotsById;
        mapping(address => bytes32) ballotIdsByAddress;
        mapping(address => uint) candidateVotes;
        ElectionSettings.Data settings;
    }
    function load(uint id) internal pure returns (Data storage election) {
        bytes32 s = keccak256(abi.encode("io.synthetix.synthetix.Election", id));
        assembly {
            election.slot := s
        }
    }
}

// @custom:artifact contracts/storage/ElectionSettings.sol:ElectionSettings
library ElectionSettings {
    struct Data {
        uint8 nextEpochSeatCount;
        uint8 minimumActiveMembers;
        uint64 minEpochDuration;
        uint64 minNominationPeriodDuration;
        uint64 minVotingPeriodDuration;
        uint64 maxDateAdjustmentTolerance;
        uint defaultBallotEvaluationBatchSize;
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

// @custom:artifact contracts/submodules/election/ElectionCredentials.sol:ElectionCredentials
contract ElectionCredentials {
    bytes32 internal constant _COUNCIL_NFT_SYSTEM = "councilToken";
}
