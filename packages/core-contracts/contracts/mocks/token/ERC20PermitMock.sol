//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../token/ERC20Permit.sol";

contract ERC20PermitMock is ERC20Permit {
    // solhint-disable no-empty-blocks
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ERC20Permit(name, symbol, decimals) {}

    // solhint-enable

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function getDigest(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) public view returns (bytes32) {
        uint256 nonce = nonces[owner];

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(_permitHash(), owner, spender, value, nonce, deadline))
            )
        );

        return digest;
    }

    function getPacked(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) public view returns (bytes memory) {
        uint256 nonce = nonces[owner];

        bytes memory packed = abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(abi.encode(_permitHash(), owner, spender, value, nonce, deadline))
        );

        return packed;
    }

    function getAbi(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline
    ) public view returns (bytes memory) {
        uint256 nonce = nonces[owner];

        bytes memory packed = abi.encode(_permitHash(), owner, spender, value, nonce, deadline);

        return packed;
    }
}

contract HandlerMock {
    bytes4 private constant _SELECTOR_PERMIT =
        bytes4(keccak256(bytes("permit(address,address,uint256,uint256,uint8,bytes32,bytes32)")));
    bytes4 private constant _SELECTOR_TRANSFER_FROM = bytes4(keccak256(bytes("transferFrom(address,address,uint256)")));

    function approveAndReceive(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        (bool successPermit, bytes memory dataPermit) = token.call(
            abi.encodeWithSelector(_SELECTOR_PERMIT, owner, spender, value, deadline, v, r, s)
        );
        require(successPermit && (dataPermit.length == 0 || abi.decode(dataPermit, (bool))), "TRANSFER_FAILED_PERMIT");

        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(_SELECTOR_TRANSFER_FROM, owner, address(this), value)
        );

        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }
}
