//SPDX-License-Identifier: MIT
pragma solidity >=0.8.11 <0.9.0;

import {AccessError} from "@synthetixio/core-contracts/contracts/errors/AccessError.sol";
import {ERC2771Context} from "@synthetixio/core-contracts/contracts/utils/ERC2771Context.sol";

library Clearinghouse {
    bytes32 private constant _SLOT_CLEARING_HOUSE =
        keccak256(abi.encode("io.synthetix.perps-market.Clearinghouse"));

    struct Data {
        /// @notice bit mapping that stores whether a conditional
        /// order nonce has been executed
        /// @dev nonce is specific to the account id associated
        /// with the conditional order
        mapping(uint128 accountId => mapping(uint256 index => uint256 bitmap)) nonceBitmap;
    }

    /// @notice thrown when attempting to re-use a nonce
    error InvalidNonce();

    function load() internal pure returns (Data storage clearingHouseData) {
        bytes32 s = _SLOT_CLEARING_HOUSE;
        assembly {
            clearingHouseData.slot := s
        }
    }

    /*//////////////////////////////////////////////////////////////
                             AUTHENTICATION
    //////////////////////////////////////////////////////////////*/

    /// TODO add docs
    function isAccountOwner(uint128 _accountId, address _caller) public view returns (bool) {
        // TODO
    }

    /// TODO add docs
    function isAccountDelegate(uint128 _accountId, address _caller) external view returns (bool) {
        // TODO
    }

    /// TODO add docs
    function _isAccountOwnerOrDelegate(
        uint128 _accountId,
        address _caller
    ) internal view returns (bool) {
        // TODO
    }

    /*//////////////////////////////////////////////////////////////
                            NONCE MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// TODO add docs
    function invalidateUnorderedNonces(
        Data storage self,
        uint128 _accountId,
        uint256 _wordPos,
        uint256 _mask
    ) internal {
        if (_isAccountOwnerOrDelegate(_accountId, ERC2771Context._msgSender())) {
            /// @dev using bitwise OR to set the bit at the bit position
            /// bitmap          = .......10001
            /// mask            = .......00110
            /// bitmap | mask   = .......10111
            /// notice all set bits in the mask are now set in the bitmap
            self.nonceBitmap[_accountId][_wordPos] |= _mask;

            // TODO emit this event from the cancel fn
            // emit UnorderedNonceInvalidation(_accountId, _wordPos, _mask);
        } else {
            revert AccessError.Unauthorized(ERC2771Context._msgSender());
        }
    }

    /// TODO add docs
    function hasUnorderedNonceBeenUsed(
        Data storage self,
        uint128 _accountId,
        uint256 _nonce
    ) public view returns (bool) {
        (uint256 wordPos, uint256 bitPos) = _bitmapPositions(_nonce);

        /// @dev given bitPos == 2
        /// .......00001 becomes .......00100
        uint256 bit = 1 << bitPos;

        /// @dev given wordPos == 0 and *assume* some bits at
        /// other bit positions were already set
        /// (but not the bit at the bit position)
        /// bit             = .......00100
        /// bitmap          = .......10001
        /// bitmap & bit    = .......00000
        /// thus in this case, bitmap & bit == 0
        /// (nonce has not been used)
        ///
        /// @dev if the bit at the bit position was already set,
        /// then the nonce has been used before
        /// bit             = .......00100
        /// bitmap          = .......10101 (notice the bit at the bit position is already set)
        /// bitmap & bit    = .......00100
        /// thus in this case, bitmap & bit != 0 (nonce has been used)
        return self.nonceBitmap[_accountId][wordPos] & bit != 0;
    }

    /// @notice fetch the index of the bitmap and
    /// the bit position within
    /// the bitmap. used for *unordered* nonces
    /// @param _nonce the nonce to get the associated
    /// word and bit positions
    /// @return wordPos the word position **or index**
    /// into the nonceBitmap
    /// @return bitPos the bit position
    /// @dev The first 248 bits of the nonce value is
    /// the index of the desired bitmap
    /// @dev The last 8 bits of the nonce value is the
    /// position of the bit in the bitmap
    function _bitmapPositions(
        uint256 _nonce
    ) internal pure returns (uint256 wordPos, uint256 bitPos) {
        // shift _nonce to the right by 8 bits and
        /// cast to uint248
        /// @dev wordPos == 0 if 0 <= _nonce <= 255,
        /// 1 if 256 <= _nonce <= 511, etc.
        wordPos = _nonce >> 8;

        // cast the last 8 bits of _nonce to uint8
        /// @dev 0 <= bitPos <= 255
        bitPos = uint8(_nonce);
    }

    /// @notice checks whether a nonce is taken and
    /// sets the bit at the bit position in the bitmap
    /// at the word position
    /// @param _accountId the account id to use the nonce at
    /// @param _nonce The nonce to spend
    function _useUnorderedNonce(Data storage self, uint128 _accountId, uint256 _nonce) internal {
        (uint256 wordPos, uint256 bitPos) = _bitmapPositions(_nonce);

        /// @dev given bitPos == 2
        /// .......00001 becomes .......00100
        uint256 bit = 1 << bitPos;

        /// @dev given wordPos == 0 and *assume* some bits at
        /// other bit positions were already set
        /// (but not the bit at the bit position)
        /// bit             = .......00100
        /// bitmap          = .......10001
        /// flipped         = .......10101
        uint256 flipped = self.nonceBitmap[_accountId][wordPos] ^= bit;

        /// @dev is the bit at the bit position was already
        /// set, then the nonce has been used before
        /// (refer to the example above, but this time
        /// assume the bit at the bit position was already set)
        /// bit             = .......00100
        /// bitmap          = .......10101 (notice the bit at the bit position is already set)
        /// flipped         = .......10001
        /// thus in this case, flipped & bit == 0
        /// flipped         = .......10001
        /// bit             = .......00100
        /// flipped & bit   = .......00000
        ///
        /// @dev if the bit at the bit position was not already
        /// set, then the nonce has not been used before
        /// bit             = .......00100
        /// bitmap          = .......10001 (notice the bit at the bit position is (not set)
        /// flipped         = .......10101
        /// thus in this case, flipped & bit != 0
        /// flipped         = .......10101
        /// bit             = .......00100
        /// flipped & bit   = .......00100
        if (flipped & bit == 0) revert InvalidNonce();
    }
}
