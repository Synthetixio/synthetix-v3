//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "@synthetixio/core-modules/contracts/submodules/election/ElectionBase.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/errors/ChangeError.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";
import "../../storage/DebtShareStorage.sol";

/// @dev Uses a merkle tree to track user Synthetix v2 debt shares on other chains at a particular block number
contract CrossChainDebtShareManager is ElectionBase, DebtShareStorage {
    error MerkleRootNotSet();
    error InvalidMerkleProof();
    error CrossChainDebtShareAlreadyDeclared();

    event CrossChainDebtShareMerkleRootSet(bytes32 merkleRoot, uint blocknumber, uint epoch);
    event CrossChainDebtShareDeclared(address user, uint debtShare);

    function _setCrossChainDebtShareMerkleRoot(bytes32 merkleRoot, uint blocknumber) internal {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        debtShareData.merkleRoot = merkleRoot;
        debtShareData.merkleRootBlockNumber = blocknumber;
    }

    function _declareCrossChainDebtShare(
        address user,
        uint256 debtShare,
        bytes32[] calldata merkleProof
    ) internal {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        if (debtShareData.debtShares[user] != 0) {
            revert CrossChainDebtShareAlreadyDeclared();
        }

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        bytes32 leaf = keccak256(abi.encodePacked(user, debtShare));

        if (!MerkleProof.verify(merkleProof, debtShareData.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        debtShareData.debtShares[user] = debtShare;
    }

    function _getCrossChainDebtShareMerkleRoot() internal view returns (bytes32) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        return debtShareData.merkleRoot;
    }

    function _getCrossChainDebtShareMerkleRootBlockNumber() internal view returns (uint) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        if (debtShareData.merkleRoot == 0) {
            revert MerkleRootNotSet();
        }

        return debtShareData.merkleRootBlockNumber;
    }

    function _getDeclaredCrossChainDebtShare(address user) internal view returns (uint) {
        CrossChainDebtShareData storage debtShareData = _debtShareStore().crossChainDebtShareData[_getCurrentEpochIndex()];

        return debtShareData.debtShares[user];
    }

    function _setCrossDomainMessenger(address newCrossDomainMessengerAddress) internal {
        DebtShareStore storage store = _debtShareStore();

        if (newCrossDomainMessengerAddress == address(0)) {
            revert AddressError.ZeroAddress();
        }

        if (newCrossDomainMessengerAddress == address(store.crossDomainMessenger)) {
            revert ChangeError.NoChange();
        }

        if (!AddressUtil.isContract(newCrossDomainMessengerAddress)) {
            revert AddressError.NotAContract(newCrossDomainMessengerAddress);
        }

        store.crossDomainMessenger = ICrossDomainMessenger(newCrossDomainMessengerAddress);
    }

    function _getCrossDomainMessenger() internal view returns (address) {
        return address(_debtShareStore().crossDomainMessenger);
    }

    function _validateCrossChainMessage(address user) internal {
        ICrossDomainMessenger messenger = ICrossDomainMessenger(_debtShareStore().crossDomainMessenger);

        if (address(messenger) == address(0)) {
            revert CrossDomainMessengerNotSet();
        }

        if (msg.sender != address(messenger)) {
            revert OnlyCrossDomainMessengerCanInvoke();
        }

        if (messenger.xDomainMessageSender() != user) {
            revert OnlyCrossDomainUserCanInvoke();
        }
    }
}
