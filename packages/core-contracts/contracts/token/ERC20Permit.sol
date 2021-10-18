// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import "./ERC20.sol";

/// @notice Modern and gas efficient ERC20 + EIP-2612 implementation.
/// @author Modified from Uniswap (https://github.com/Uniswap/uniswap-v2-core/blob/master/contracts/UniswapV2ERC20.sol)
/// @author Modified from Rari-Capital (https://github.com/Rari-Capital/solmate/blob/main/src/erc20/ERC20.sol)
abstract contract ERC20Permit is ERC20 {
    bytes32 public immutable DOMAIN_SEPARATOR;

    mapping(address => uint256) public nonces;

    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) ERC20(tokenName, tokenSymbol, tokenDecimals) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(_eip712Domain(), keccak256(bytes(tokenName)), _one(), block.chainid, address(this))
        );
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        require(deadline >= block.timestamp, "PERMIT_DEADLINE_EXPIRED");

        uint256 nonce = nonces[owner]++;

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(_permitHash(), owner, spender, value, nonce, deadline))
            )
        );

        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, "INVALID_PERMIT_SIGNATURE");

        allowance[recoveredAddress][spender] = value;

        emit Approval(owner, spender, value);
    }

    function _permitHash() internal pure returns (bytes32 permitHash) {
        assembly {
            // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
            permitHash := 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9
        }
    }

    function _eip712Domain() internal pure returns (bytes32 eip712Domain) {
        assembly {
            // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            eip712Domain := 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f
        }
    }

    function _one() internal pure returns (bytes32 one) {
        assembly {
            // keccak256(bytes("1"));
            one := 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6
        }
    }
}
