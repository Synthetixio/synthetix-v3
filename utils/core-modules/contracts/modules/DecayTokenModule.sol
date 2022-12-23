//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";

import "../interfaces/IDecayTokenModule.sol";
import "../storage/DecayToken.sol";

contract DecayTokenModule is IDecayTokenModule, ERC20, InitializableMixin {
    using DecimalMath for uint256;

    // DOCS: use existing super.totalSupply() for total shares, super.balanceOf() for account share balance, etc.

    modifier advanceEpoch() {
        _;
        DecayToken.Data storage store = DecayToken.load();
        store.epochStart = block.timestamp;
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

        uint256 shareAmount = _tokenToShare(amount);
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply() - amount;

        super._burn(from, shareAmount);
    }

    function mint(address to, uint256 amount) external override advanceEpoch {
        OwnableStorage.onlyOwner();

        uint256 shareAmount = _tokenToShare(amount);
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply() + amount;

        super._mint(to, shareAmount);
    }

    function setInterestRate(uint256 _rate) external advanceEpoch {
        OwnableStorage.onlyOwner();
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply();
        store.interestRate = _rate;
    }

    function totalSupply() public view virtual override(ERC20, IERC20) returns (uint256) {
        uint256 totalShares = ERC20Storage.load().totalSupply;
        if (_totalSupplyAtEpochStart() == 0) {
            return totalShares;
        }
        return (
            _totalSupplyAtEpochStart().mulDecimal(
                ((10 ** 18) - ((block.timestamp - _epochStart()) * _ratePerSecond()))
            )
        );
    }

    function balanceOf(address owner) public view override(ERC20, IERC20) returns (uint256) {
        return super.balanceOf(owner).mulDecimal(_tokensPerShare());
    }

    function allowance(
        address owner,
        address spender
    ) public view virtual override(ERC20, IERC20) returns (uint256) {
        return super.allowance(owner, spender);
    }

    function approve(
        address spender,
        uint256 amount
    ) public virtual override(ERC20, IERC20) returns (bool) {
        return super.approve(spender, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external virtual override(ERC20, IERC20) returns (bool) {
        return super._transferFrom(from, to, _tokensPerShare().mulDecimal(amount));
    }

    function setAllowance(address from, address spender, uint256 amount) external override {
        ERC20Storage.load().allowance[from][spender] = amount;
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override(ERC20, IERC20) returns (bool) {
        return super.transfer(to, _tokenToShare(amount));
    }

    function tokensPerShare() public view virtual returns (uint256) {
        return _tokensPerShare();
    }

    function interestRate() public view returns (uint256) {
        return DecayToken.load().interestRate;
    }

    function totalSupplyAtEpochStart() public view returns (uint256) {
        return _totalSupplyAtEpochStart();
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
        return interestRate() / 31536000;
    }

    function _tokensPerShare() internal view returns (uint256) {
        uint256 totalShares = ERC20Storage.load().totalSupply;

        if (_totalSupplyAtEpochStart() == 0 || totalShares == 0) {
            return DecimalMath.UNIT;
        }

        return totalSupply().divDecimal(totalShares);
    }

    function _tokenToShare(uint256 amount) internal view returns (uint256) {
        uint256 tokenPerShare = _tokensPerShare();

        return (tokenPerShare > 0 ? amount.divDecimal(tokenPerShare) : amount);
    }
}
