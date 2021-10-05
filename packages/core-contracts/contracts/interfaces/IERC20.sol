//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IERC20 {
    event Transfer(address indexed from, address indexed to, uint amount);

    event Approval(address indexed owner, address indexed spender, uint amount);

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint);

    function balanceOf(address owner) external view returns (uint);

    function allowance(address owner, address spender) external view returns (uint);

    function transfer(address to, uint amount) external returns (bool);

    function approve(address spender, uint amount) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint amount
    ) external returns (bool);
}
