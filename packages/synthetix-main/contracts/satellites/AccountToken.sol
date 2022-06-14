//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/proxy/UUPSImplementation.sol";
import "@synthetixio/core-contracts/contracts/ownership/Ownable.sol";
import "@synthetixio/core-contracts/contracts/token/ERC721.sol";
import "@synthetixio/core-contracts/contracts/utils/AddressUtil.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";
import "@synthetixio/core-contracts/contracts/errors/AddressError.sol";

import "../interfaces/IAccountToken.sol";
import "../storage/AccountTokenStorage.sol";

import "../interfaces/IAccountModule.sol";

contract AccountToken is IAccountToken, ERC721, AccountTokenStorage, InitializableMixin, UUPSImplementation, Ownable {
    event AccountMinted(address owner, uint accountId);

    // ---------------------------------------
    // Chores
    // ---------------------------------------
    function _isInitialized() internal view override returns (bool) {
        return _accountStore().initialized;
    }

    function isAccountInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        string memory uri,
        address mainProxy
    ) public onlyOwner {
        _initialize(tokenName, tokenSymbol, uri);
        AccountStore storage store = _accountStore();

        store.mainProxy = mainProxy;
        store.initialized = true;
    }

    function upgradeTo(address newImplementation) public override onlyOwner {
        _upgradeTo(newImplementation);
    }

    // ---------------------------------------
    // Mint/Transfer
    // ---------------------------------------
    function mint(address owner, uint256 accountId) external override onlyOwner {
        _mint(owner, accountId);

        emit AccountMinted(owner, accountId);
    }

    function _postTransfer(
        // solhint-disable-next-line no-unused-vars
        address from,
        address to,
        uint256 accountId
    ) internal virtual override {
        IAccountModule(_accountStore().mainProxy).transferAccount(to, accountId);
    }
}
