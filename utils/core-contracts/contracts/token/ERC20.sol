//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "../interfaces/IERC20.sol";
import "../errors/InitError.sol";
import "./ERC20Storage.sol";

/*
 * @title ERC20 token implementation.
 * See IERC20.
 *
 * Reference implementations:
 * - OpenZeppelin - https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
 * - Rari-Capital - https://github.com/Rari-Capital/solmate/blob/main/src/tokens/ERC20.sol
 */
contract ERC20 is IERC20 {
    /**
     * @inheritdoc IERC20
     */
    function name() external view override returns (string memory) {
        return ERC20Storage.load().name;
    }

    /**
     * @inheritdoc IERC20
     */
    function symbol() external view override returns (string memory) {
        return ERC20Storage.load().symbol;
    }

    /**
     * @inheritdoc IERC20
     */
    function decimals() external view override returns (uint8) {
        return ERC20Storage.load().decimals;
    }

    /**
     * @inheritdoc IERC20
     */
    function totalSupply() external view virtual override returns (uint256) {
        return ERC20Storage.load().totalSupply;
    }

    /**
     * @inheritdoc IERC20
     */
    function allowance(
        address owner,
        address spender
    ) public view virtual override returns (uint256) {
        return ERC20Storage.load().allowance[owner][spender];
    }

    /**
     * @inheritdoc IERC20
     */
    function balanceOf(address owner) public view virtual override returns (uint256) {
        return ERC20Storage.load().balanceOf[owner];
    }

    /**
     * @inheritdoc IERC20
     */
    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /**
     * @inheritdoc IERC20
     */
    function increaseAllowance(
        address spender,
        uint256 addedValue
    ) public virtual override returns (bool) {
        uint256 currentAllowance = ERC20Storage.load().allowance[msg.sender][spender];
        _approve(msg.sender, spender, currentAllowance + addedValue);

        return true;
    }

    /**
     * @inheritdoc IERC20
     */
    function decreaseAllowance(
        address spender,
        uint256 subtractedValue
    ) public virtual override returns (bool) {
        uint256 currentAllowance = ERC20Storage.load().allowance[msg.sender][spender];
        _approve(msg.sender, spender, currentAllowance - subtractedValue);

        return true;
    }

    /**
     * @inheritdoc IERC20
     */
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, to, amount);

        return true;
    }

    /**
     * @inheritdoc IERC20
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external virtual override returns (bool) {
        return _transferFrom(from, to, amount);
    }

    function _transferFrom(
        address from,
        address to,
        uint256 amount
    ) internal virtual returns (bool) {
        ERC20Storage.Data storage store = ERC20Storage.load();

        uint256 currentAllowance = store.allowance[from][msg.sender];
        if (currentAllowance < amount) {
            revert InsufficientAllowance(amount, currentAllowance);
        }

        unchecked {
            store.allowance[from][msg.sender] -= amount;
        }

        _transfer(from, to, amount);

        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal virtual {
        ERC20Storage.Data storage store = ERC20Storage.load();

        uint256 accountBalance = store.balanceOf[from];
        if (accountBalance < amount) {
            revert InsufficientBalance(amount, accountBalance);
        }

        // We are now sure that we can perform this operation safely
        // since it didn't revert in the previous step.
        // The total supply cannot exceed the maximum value of uint256,
        // thus we can now perform accounting operations in unchecked mode.
        unchecked {
            store.balanceOf[from] -= amount;
            store.balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        ERC20Storage.load().allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address to, uint256 amount) internal virtual {
        ERC20Storage.Data storage store = ERC20Storage.load();

        store.totalSupply += amount;

        // No need for overflow check since it is done in the previous step
        unchecked {
            store.balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal virtual {
        ERC20Storage.Data storage store = ERC20Storage.load();

        uint256 accountBalance = store.balanceOf[from];
        if (accountBalance < amount) {
            revert InsufficientBalance(amount, accountBalance);
        }

        // No need for underflow check since it would have occured in the previous step
        unchecked {
            store.balanceOf[from] -= amount;
            store.totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }

    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal virtual {
        ERC20Storage.Data storage store = ERC20Storage.load();

        if (bytes(store.name).length > 0 || bytes(store.symbol).length > 0 || store.decimals > 0) {
            revert InitError.AlreadyInitialized();
        }

        store.name = tokenName;
        store.symbol = tokenSymbol;
        store.decimals = tokenDecimals;
    }
}
