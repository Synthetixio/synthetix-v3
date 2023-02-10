//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/MerkleProof.sol";
import "@synthetixio/core-modules/contracts/submodules/election/ElectionBase.sol";
import "../../storage/DebtShareStorage.sol";

/// @dev Uses a merkle tree to track user Synthetix v2 debt shares on other chains at a particular block number
contract CrossChainDebtShareManager is ElectionBase, DebtShareStorage {
    error MerkleRootNotSet();
    error InvalidMerkleProof();
    error CrossChainDebtShareAlreadyDeclared();

    event CrossChainDebtShareMerkleRootSet(bytes32 merkleRoot, uint blocknumber, uint epoch);
    event CrossChainDebtShareDeclared(address user, uint debtShare);

    address private constant _L2CrossDomainMessenger = 0x4200000000000000000000000000000000000007;

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

    function _validateCrossChainMessage(address user) internal view {
        ICrossDomainMessenger messenger = ICrossDomainMessenger(_L2CrossDomainMessenger);

        if (msg.sender != address(messenger)) {
            revert OnlyCrossDomainMessengerCanInvoke();
        }

        if (messenger.xDomainMessageSender() != user) {
            revert OnlyCrossDomainUserCanInvoke();
        }
    }
}
