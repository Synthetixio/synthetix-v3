//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

contract CollateralMockWithoutDecimals {
    bytes32 private constant _SLOT_ERC20_STORAGE =
        keccak256(abi.encode("io.synthetix.core-contracts.ERC20"));

    struct Data {
        string name;
        string symbol;
        mapping(address => uint256) balanceOf;
        mapping(address => mapping(address => uint256)) allowance;
        uint256 totalSupply;
    }

    function load() internal pure returns (Data storage store) {
        bytes32 s = _SLOT_ERC20_STORAGE;
        assembly {
            store.slot := s
        }
    }

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    error InsufficientAllowance(uint256 required, uint256 existing);
    error InsufficientBalance(uint256 required, uint256 existing);
    error AlreadyInitialized();
    error NotInitialized();

    function initialize(string memory tokenName, string memory tokenSymbol) public {
        _initialize(tokenName, tokenSymbol);
    }

    function burn(uint256 amount) external {
        _burn(ERC2771Context._msgSender(), amount);
    }

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }

    function name() external view returns (string memory) {
        return load().name;
    }

    function symbol() external view returns (string memory) {
        return load().symbol;
    }

    /**
     * @dev decimals() was intentionally removed from this mock contract.
     */

    // function decimals() external view  returns (uint8) {}

    function totalSupply() external view returns (uint256) {
        return load().totalSupply;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return load().allowance[owner][spender];
    }

    function balanceOf(address owner) public view returns (uint256) {
        return load().balanceOf[owner];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(ERC2771Context._msgSender(), spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public returns (bool) {
        uint256 currentAllowance = load().allowance[ERC2771Context._msgSender()][spender];
        _approve(ERC2771Context._msgSender(), spender, currentAllowance + addedValue);

        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool) {
        uint256 currentAllowance = load().allowance[ERC2771Context._msgSender()][spender];
        _approve(ERC2771Context._msgSender(), spender, currentAllowance - subtractedValue);

        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(ERC2771Context._msgSender(), to, amount);

        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        return _transferFrom(from, to, amount);
    }

    function _transferFrom(address from, address to, uint256 amount) internal returns (bool) {
        Data storage store = load();

        uint256 currentAllowance = store.allowance[from][ERC2771Context._msgSender()];
        if (currentAllowance < amount) {
            revert InsufficientAllowance(amount, currentAllowance);
        }

        unchecked {
            store.allowance[from][ERC2771Context._msgSender()] -= amount;
        }

        _transfer(from, to, amount);

        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        Data storage store = load();

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

    function _approve(address owner, address spender, uint256 amount) internal {
        load().allowance[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address to, uint256 amount) internal {
        Data storage store = load();

        store.totalSupply += amount;

        // No need for overflow check since it is done in the previous step
        unchecked {
            store.balanceOf[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        Data storage store = load();

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

    function _initialize(string memory tokenName, string memory tokenSymbol) internal {
        Data storage store = load();

        if (bytes(store.name).length > 0 || bytes(store.symbol).length > 0) {
            revert AlreadyInitialized();
        }

        store.name = tokenName;
        store.symbol = tokenSymbol;
    }
}
