//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/DecimalMath.sol";
import "@synthetixio/core-contracts/contracts/token/ERC20.sol";
import "@synthetixio/core-contracts/contracts/ownership/OwnableStorage.sol";
import "@synthetixio/core-contracts/contracts/initializable/InitializableMixin.sol";

import "../interfaces/IDecayTokenModule.sol";
import "../storage/DecayToken.sol";

import "./TokenModule.sol";

contract DecayTokenModule is IDecayTokenModule, TokenModule {
    using DecimalMath for uint256;

    uint private constant SECONDS_PER_YEAR = 31536000;

    modifier _advanceEpoch() {
        _;
        DecayToken.Data storage store = DecayToken.load();
        store.epochStart = block.timestamp;
    }

    /**
     * @inheritdoc ITokenModule
     */
    function initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) public payable override(TokenModule, ITokenModule) {
        OwnableStorage.onlyOwner();
        super._initialize(tokenName, tokenSymbol, tokenDecimals);

        DecayToken.Data storage store = DecayToken.load();
        if (store.epochStart == 0) {
            store.epochStart = block.timestamp;
        }
    }

    /**
     * @inheritdoc ITokenModule
     */
    function isInitialized() external view override(TokenModule, ITokenModule) returns (bool) {
        return super._isInitialized();
    }

    /**
     * @inheritdoc ITokenModule
     */
    function burn(
        address from,
        uint256 amount
    ) external payable override(TokenModule, ITokenModule) _advanceEpoch {
        OwnableStorage.onlyOwner();

        uint256 shareAmount = _tokenToShare(amount);
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply() - amount;

        super._burn(from, shareAmount);
    }

    /**
     * @inheritdoc ITokenModule
     */
    function mint(
        address to,
        uint256 amount
    ) external payable override(TokenModule, ITokenModule) _advanceEpoch {
        OwnableStorage.onlyOwner();

        uint256 shareAmount = _tokenToShare(amount);
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply() + amount;

        super._mint(to, shareAmount);
    }

    /**
     * @inheritdoc IDecayTokenModule
     */
    function setDecayRate(uint256 _rate) external payable _advanceEpoch {
        if ((10 ** 18) * SECONDS_PER_YEAR < _rate) {
            revert InvalidDecayRate();
        }
        OwnableStorage.onlyOwner();
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply();
        store.decayRate = _rate;
    }

    /**
     * @inheritdoc IDecayTokenModule
     */
    function advanceEpoch() external payable _advanceEpoch returns (uint256) {
        DecayToken.Data storage store = DecayToken.load();
        store.totalSupplyAtEpochStart = totalSupply();
        return _tokensPerShare();
    }

    function totalShares() public view virtual returns (uint256) {
        return ERC20Storage.load().totalSupply;
    }

    function totalSupply() public view virtual override(ERC20, IERC20) returns (uint256 supply) {
        if (_totalSupplyAtEpochStart() == 0) {
            return totalShares();
        }
        uint t = (block.timestamp - _epochStart());
        supply = _totalSupplyAtEpochStart();
        uint r = _pow(((DecimalMath.UNIT) - _ratePerSecond()), t);
        supply = supply.mulDecimal(r);

        return (supply);
    }

    function balanceOf(address user) public view override(ERC20, IERC20) returns (uint256) {
        return super.balanceOf(user).mulDecimal(_tokensPerShare());
    }

		// solhint-disable-next-line payable/only-payable
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external virtual override(ERC20, IERC20) returns (bool) {
        ERC20Storage.Data storage store = ERC20Storage.load();

        uint256 currentAllowance = store.allowance[from][msg.sender];
        if (currentAllowance < amount) {
            revert InsufficientAllowance(amount, currentAllowance);
        }

        unchecked {
            store.allowance[from][msg.sender] -= amount;
        }

        super._transfer(from, to, _tokenToShare(amount));

        return true;
    }

	  // solhint-disable-next-line payable/only-payable
    function transfer(
        address to,
        uint256 amount
    ) public virtual override(ERC20, IERC20) returns (bool) {
        return super.transfer(to, _tokenToShare(amount));
    }

    function decayRate() public view returns (uint256) {
        return DecayToken.load().decayRate;
    }

    function _epochStart() internal view returns (uint256) {
        return DecayToken.load().epochStart;
    }

    function _totalSupplyAtEpochStart() internal view returns (uint256) {
        return DecayToken.load().totalSupplyAtEpochStart;
    }

    function _ratePerSecond() internal view returns (uint256) {
        return decayRate() / SECONDS_PER_YEAR;
    }

    function _tokensPerShare() internal view returns (uint256) {
        uint256 shares = totalShares();

        if (_totalSupplyAtEpochStart() == 0 || totalSupply() == 0 || shares == 0) {
            return DecimalMath.UNIT;
        }

        return totalSupply().divDecimal(shares);
    }

    function _tokenToShare(uint256 amount) internal view returns (uint256) {
        uint256 tokenPerShare = _tokensPerShare();

        return (tokenPerShare > 0 ? amount.divDecimal(tokenPerShare) : amount);
    }

    function _pow(uint256 x, uint n) internal pure returns (uint256 r) {
        r = 1e18;
        while (n > 0) {
            if (n % 2 == 1) {
                r = r.mulDecimal(x);
                n -= 1;
            } else {
                x = x.mulDecimal(x);
                n /= 2;
            }
        }
    }
}
