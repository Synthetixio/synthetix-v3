pragma solidity ^0.8.0;

import "@synthetixio/core-contracts/contracts/token/ERC20.sol";

/* 
    Synth abstraction 
    i.e snxBtc, snxEth, snxUsd ...
*/
contract Synth is ERC20 {
    address public owner;

    constructor(
        address marketOwner,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) {
        _initialize(name, symbol, decimals);
        owner = marketOwner;
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
