//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";

import "../interfaces/IFundToken.sol";
import "../storage/FundTokenStorage.sol";

contract FundToken is IFundToken, ERC721, FundTokenStorage, InitializableMixin, UUPSImplementation, Ownable {
    event FundMinted(address owner, uint fundId);
    event NominatedNewOwner(address nominatedOwner, uint256 fundId);
    event OwnershipAccepted(address owner, uint256 fundId);
    event OwnershipRenounced(address owner, uint256 fundId);

    /////////////////////////////////////////////////
    // CHORES
    /////////////////////////////////////////////////

    function _isInitialized() internal view override returns (bool) {
        return _fundTokenStore().initialized;
    }

    function isFundTokenInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
        _fundTokenStore().initialized = true;
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    /////////////////////////////////////////////////
    // SYSTEM OWNED FUCTIONS
    /////////////////////////////////////////////////
    function mint(address owner, uint256 fundId) external override {
        _mint(owner, fundId);

        emit FundMinted(owner, fundId);
    }

    function nominateNewOwner(
        address sender,
        address nominatedOwner,
        uint256 fundId
    ) external override onlyOwner {
        if (!_isApprovedOrOwner(sender, fundId)) {
            revert AccessError.Unauthorized(sender);
        }

        _fundTokenStore().nominatedOwnerOf[fundId] = nominatedOwner;

        emit NominatedNewOwner(nominatedOwner, fundId);
    }

    function acceptOwnership(address sender, uint256 fundId) external override onlyOwner {
        if (_fundTokenStore().nominatedOwnerOf[fundId] != sender) {
            revert AccessError.Unauthorized(sender);
        }

        safeTransferFrom(ownerOf(fundId), sender, fundId);

        _fundTokenStore().nominatedOwnerOf[fundId] = address(0);

        emit OwnershipAccepted(sender, fundId);
    }

    function renounceNomination(address sender, uint256 fundId) external override onlyOwner {
        if (_fundTokenStore().nominatedOwnerOf[fundId] != sender) {
            revert AccessError.Unauthorized(sender);
        }

        _fundTokenStore().nominatedOwnerOf[fundId] = address(0);

        emit OwnershipRenounced(sender, fundId);
    }
    /////////////////////////////////////////////////
    // STAKE  /  UNSTAKE
    /////////////////////////////////////////////////
}
