//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import "./ERC20.sol";
import "./ERC20PermitStorage.sol";
import "./ERC20Storage.sol";
import "../interfaces/IERC20Permit.sol";

/*
 * @title ERC20Permit token implementation.
 * See IERC20Permit.
 *
 * Reference implementations:
 * - Rari-Capital - https://github.com/Rari-Capital/solmate/blob/main/src/tokens/ERC20.sol
 */
contract ERC20Permit is ERC20, IERC20Permit {
    function _initialize(
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) internal virtual override {
        super._initialize(tokenName, tokenSymbol, tokenDecimals);

        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        store.initialChainId = block.chainid;
        store.initialDomainSeprator = _computeDomainSeparator();
    }

    /**
     * @inheritdoc IERC20Permit
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual {
        if (deadline < block.timestamp) {
            revert PermitDeadlineExpired();
        }

        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();

        uint256 nonce = store.nonces[owner];

        unchecked {
            address recoveredAddress = ecrecover(
                keccak256(
                    abi.encodePacked(
                        "\x19\x01",
                        DOMAIN_SEPARATOR(),
                        keccak256(
                            abi.encode(
                                keccak256(
                                    "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
                                ),
                                owner,
                                spender,
                                value,
                                nonce,
                                deadline
                            )
                        )
                    )
                ),
                v,
                r,
                s
            );

            store.nonces[owner] = nonce + 1;

            if (recoveredAddress == address(0) || recoveredAddress != owner) {
                revert InvalidSigner(recoveredAddress);
            }

            _approve(recoveredAddress, spender, value);
        }
    }

    /**
     * @inheritdoc IERC20Permit
     */
    function nonces(address owner) public view virtual returns (uint256) {
        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        return store.nonces[owner];
    }

    /**
     * @inheritdoc IERC20Permit
     */
    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() public view virtual returns (bytes32) {
        ERC20PermitStorage.Data storage store = ERC20PermitStorage.load();
        return
            block.chainid == store.initialChainId
                ? store.initialDomainSeprator
                : _computeDomainSeparator();
    }

    function _computeDomainSeparator() internal view virtual returns (bytes32) {
        ERC20Storage.Data storage store = ERC20Storage.load();
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256(bytes(store.name)),
                    keccak256("1"),
                    block.chainid,
                    address(this)
                )
            );
    }
}
