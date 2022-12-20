//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../initializable/InitializableMixin.sol";
import "../ownership/OwnableStorage.sol";
import "./ERC20.sol";

import "./DecayTokenStorage.sol";

contract DecayToken is ERC20, InitializableMixin {
    // TODO: Use SafeMath

    // DOCS: use existing super.totalSupply() for total shares, super.balanceOf() for account share balance, etc.

    modifier advanceEpoch() {
        _;
        DecayTokenStorage.Data storage store = DecayTokenStorage.load();
        store.epochStart = block.timestamp;
        store.totalSupplyAtEpochStart = totalSupply();
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal virtual override {
        super._initialize(tokenName, tokenSymbol, tokenDecimals);

        DecayTokenStorage.Data storage store = DecayTokenStorage.load();
        store.epochStart = block.timestamp;
    }

    function interestRate() public view virtual returns (uint256) {
        return DecayTokenStorage.load().interestRate;
    }

    function epochStart() public view virtual returns (uint256) {
        return DecayTokenStorage.load().epochStart;
    }

    function totalSupplyAtEpochStart() public view virtual returns (uint256) {
        return DecayTokenStorage.load().totalSupplyAtEpochStart;
    }

    function ratePerSecond() public view virtual returns (uint256) {
        return interestRate() / 3153600000;
    }

    function totalSupply() public view virtual override returns (uint256) {
        uint256 totalShares = ERC20Storage.load().totalSupply;
        return totalShares * tokensPerShare();
    }

    function balanceOf(address owner) public view override returns (uint256) {
        return super.balanceOf(owner) / tokensPerShare();
    }

    function _burn(address from, uint256 amount) internal override advanceEpoch {
        uint256 shareAmount = amount / tokensPerShare();
        super._burn(from, shareAmount);
    }

    function _mint(address to, uint256 amount) internal override advanceEpoch {
        uint256 shareAmount = amount / tokensPerShare();
        super._mint(to, shareAmount);
    }

    // DOCS: e.g. Interest Rate: 4%, 1 year has passed, this returns 0.96;
    function tokensPerShare() public view returns (uint256) {
        return
            (1 * 10**18) -
            (totalSupplyAtEpochStart() - (block.timestamp - epochStart()) * ratePerSecond());
    }

    function _setInterestRate(uint256 _interestRate) public advanceEpoch {
        DecayTokenStorage.Data storage store = DecayTokenStorage.load();
        store.interestRate = _interestRate;
    }

    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }
}
