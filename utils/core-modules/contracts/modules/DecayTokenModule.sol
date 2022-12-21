//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";

import "../interfaces/IDecayTokenModule.sol";
import "../storage/DecayToken.sol";

contract DecayTokenModule is IDecayTokenModule, ERC20, InitializableMixin {
    // TODO: Use SafeMath

    // DOCS: use existing super.totalSupply() for total shares, super.balanceOf() for account share balance, etc.

    modifier advanceEpoch() {
        _;
        DecayToken.Data storage store = DecayToken.load();
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

        DecayToken.Data storage store = DecayToken.load();
        store.epochStart = block.timestamp;
    }

    function interestRate() public view virtual returns (uint256) {
        return DecayToken.load().interestRate;
    }

    function epochStart() public view virtual returns (uint256) {
        return DecayToken.load().epochStart;
    }

    function totalSupplyAtEpochStart() public view virtual returns (uint256) {
        return DecayToken.load().totalSupplyAtEpochStart;
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
        return (totalSupplyAtEpochStart() *
            ((1 * 10 ** 18) - (block.timestamp - epochStart() * ratePerSecond())));
    }

    function _setInterestRate(uint256 _interestRate) internal advanceEpoch {
        DecayToken.Data storage store = DecayToken.load();
        store.interestRate = _interestRate;
    }

    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return tokensPerShare() / super.allowance(owner, spender);
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        uint256 amount = amount / tokensPerShare();
        return super.approve(spender, amount);
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        uint256 amount = amount / tokensPerShare();
        return super.transfer(to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external virtual override returns (bool) {
        uint256 amount = amount / tokensPerShare();
        return super.transferFrom(from, to, amount);
    }
}
