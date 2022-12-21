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

    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public {
        OwnableStorage.onlyOwner();
        super._initialize(tokenName, tokenSymbol, tokenDecimals);

        DecayToken.Data storage store = DecayToken.load();
        store.epochStart = block.timestamp;
    }

    function isInitialized() external view returns (bool) {
        return _isInitialized();
    }

    function burn(address from, uint256 amount) external override advanceEpoch {
        OwnableStorage.onlyOwner();
        uint256 shareAmount = amount / _tokensPerShare();
        super._burn(from, shareAmount);
    }

    function mint(address to, uint256 amount) external override advanceEpoch {
        OwnableStorage.onlyOwner();
        uint256 shareAmount = amount / _tokensPerShare();
        super._mint(to, shareAmount);
    }

    function setInterestRate(uint256 _rate) external advanceEpoch {
        OwnableStorage.onlyOwner();
        DecayToken.Data storage store = DecayToken.load();
        store.interestRate = _rate;
    }

    function totalSupply() public view virtual override(ERC20, IERC20) returns (uint256) {
        uint256 totalShares = ERC20Storage.load().totalSupply;
        return totalShares * _tokensPerShare();
    }

    function balanceOf(address owner) public view override(ERC20, IERC20) returns (uint256) {
        return super.balanceOf(owner) / _tokensPerShare();
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override(ERC20, IERC20) returns (uint256) {
        return _tokensPerShare() / super.allowance(owner, spender);
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override(ERC20, IERC20) returns (bool) {
        return super.approve(spender, amount / _tokensPerShare());
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override(ERC20, IERC20) returns (bool) {
        return super.transfer(to, amount / _tokensPerShare());
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external virtual override(ERC20, IERC20) returns (bool) {
        return super._transferFrom(from, to, amount / _tokensPerShare());
    }

    function setAllowance(address from, address spender, uint256 amount) external override {
        uint256 shareAmount = amount / _tokensPerShare();
        ERC20Storage.load().allowance[from][spender] = shareAmount;
    }

    function interestRate() public view returns (uint256) {
        return DecayToken.load().interestRate;
    }

    function _isInitialized() internal view override returns (bool) {
        return ERC20Storage.load().decimals != 0;
    }

    function _epochStart() internal view returns (uint256) {
        return DecayToken.load().epochStart;
    }

    function _totalSupplyAtEpochStart() internal view returns (uint256) {
        return DecayToken.load().totalSupplyAtEpochStart;
    }

    function _ratePerSecond() internal view returns (uint256) {
        return interestRate() / 3153600000;
    }

    function _tokensPerShare() internal view returns (uint256) {
        return (_totalSupplyAtEpochStart() *
            ((1 * 10 ** 18) - (block.timestamp - _epochStart() * _ratePerSecond())));
    }
}
