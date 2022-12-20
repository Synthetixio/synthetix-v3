//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-modules/contracts/modules/TokenModule.sol";

import "./DecayTokenStorage.sol";

contract DecayToken is TokenModule {
    // TODO: Use SafeMath

    // DOCS: use existing super.totalSupply() for total shares, super.balanceOf() for account share balance, etc.

    /**
     * @inheritdoc ITokenModule
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public override {
        OwnableStorage.onlyOwner();
        DecayTokenStorage.Data storage store = DecayTokenStorage.load();
        store.epochStart = block.timestamp;
        super._initialize(tokenName, tokenSymbol, tokenDecimals);
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
        return interestRate() / 31536000;
    }

    function totalSupply() public view virtual override(ERC20, IERC20) returns (uint256) {
        uint256 totalShares = ERC20Storage.load().totalSupply;
        return totalShares * tokensPerShare();
    }

    function balanceOf(address owner) public view override(ERC20, IERC20) returns (uint256) {
        return super.balanceOf(owner) / tokensPerShare();
    }

    function burn(address from, uint256 amount) external override advanceEpoch {
        OwnableStorage.onlyOwner();
        uint256 shareAmount = amount / tokensPerShare();
        super._burn(from, shareAmount);
    }

    function mint(address to, uint256 amount) external override advanceEpoch {
        OwnableStorage.onlyOwner();
        uint256 shareAmount = amount / tokensPerShare();
        super._mint(to, shareAmount);
    }

    // DOCS: e.g. Interest Rate: 4%, 1 year has passed, this returns 0.96;
    function tokensPerShare() public returns (uint256) {
        return
            (1 * 10**18) -
            (totalSupplyAtEpochStart() - (block.timestamp - epochStart()) * ratePerSecond());
    }

    function setInterestRate(uint256 _interestRate) public advanceEpoch {
        OwnableStorage.onlyOwner();
        DecayTokenStorage.Data storage store = DecayTokenStorage.load();
        store.interestRate = _interestRate;
    }

    // TODO: approve, allowance, etc. convert to shareAmount like mint/burn

    modifier advanceEpoch() {
        _;
        DecayTokenStorage.Data storage store = DecayTokenStorage.load();
        store.epochStart = block.timestamp;
        store.totalSupplyAtEpochStart = totalSupply();
    }
}
