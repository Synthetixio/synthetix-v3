pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

/* sBTC */
contract SnxBTC is ERC20 {
    address public owner;

    constructor(address newOwner) {
        _initialize("Synthetic BTC", "snxBTC", 18);
        owner = newOwner;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");

        _;
    }

    function mint(address to, uint amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint amount) external onlyOwner {
        _burn(from, amount);
    }
}
