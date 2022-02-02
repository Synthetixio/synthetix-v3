//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/IERC20HistoricalBalance.sol";
import "./ERC20.sol";
import "./ERC20HistoricalBalanceStorage.sol";

/*
    Reference implementations:
    * OpenZeppelin - https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/extensions/ERC20Votes.sol
*/

contract ERC20HistoricalBalance is ERC20, IERC20HistoricalBalance, ERC20HistoricalBalanceStorage {
    error InvalidUint32Number(uint blockNumber);
    error BlockNumberNotYetMined(uint blockNumber);

    function totalSupplyAt(uint blockNumber) external view override returns (uint) {
        if (blockNumber >= block.number) {
            revert BlockNumberNotYetMined(blockNumber);
        }

        return _checkpointsLookup(_erc20HistoricalBalanceStore().totalSupplyCheckpoints, blockNumber);
    }

    function balanceOfAt(address owner, uint blockNumber) public view override returns (uint) {
        if (blockNumber >= block.number) {
            revert BlockNumberNotYetMined(blockNumber);
        }

        return _checkpointsLookup(_erc20HistoricalBalanceStore().checkpoints[owner], blockNumber);
    }

    function _checkpointsLookup(Checkpoint[] storage ckpts, uint256 blockNumber) private view returns (uint256) {
        // We run a binary search to look for the earliest checkpoint taken after `blockNumber`.
        //
        // During the loop, the index of the wanted checkpoint remains in the range [low-1, high).
        // With each iteration, either `low` or `high` is moved towards the middle of the range to maintain the invariant.
        // - If the middle checkpoint is after `blockNumber`, we look in [low, mid)
        // - If the middle checkpoint is before or equal to `blockNumber`, we look in [mid+1, high)
        // Once we reach a single value (when low == high), we've found the right checkpoint at the index high-1, if not
        // out of bounds (in which case we're looking too far in the past and the result is 0).
        // Note that if the latest checkpoint available is exactly for `blockNumber`, we end up with an index that is
        // past the end of the array, so we technically don't find a checkpoint after `blockNumber`, but it works out
        // the same.
        uint256 high = ckpts.length;
        uint256 low = 0;
        while (low < high) {
            uint256 mid = _average(low, high);
            if (ckpts[mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return high == 0 ? 0 : ckpts[high - 1].balance;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._transfer(from, to, amount);

        _moveBalance(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override {
        super._mint(to, amount);

        _moveBalance(address(0), to, amount);
        _writeCheckpoint(_erc20HistoricalBalanceStore().totalSupplyCheckpoints, _add, amount);
    }

    function _burn(address from, uint256 amount) internal override {
        super._burn(from, amount);

        _moveBalance(from, address(0), amount);
        _writeCheckpoint(_erc20HistoricalBalanceStore().totalSupplyCheckpoints, _subtract, amount);
    }

    function _moveBalance(
        address src,
        address dst,
        uint256 amount
    ) private {
        if (src != dst && amount > 0) {
            if (src != address(0)) {
                _writeCheckpoint(_erc20HistoricalBalanceStore().checkpoints[src], _subtract, amount);
            }

            if (dst != address(0)) {
                _writeCheckpoint(_erc20HistoricalBalanceStore().checkpoints[dst], _add, amount);
            }
        }
    }

    function _writeCheckpoint(
        Checkpoint[] storage ckpts,
        function(uint256, uint256) view returns (uint256) op,
        uint256 delta
    ) private {
        uint256 pos = ckpts.length;
        uint256 oldWeight = pos == 0 ? 0 : ckpts[pos - 1].balance;
        uint256 newWeight = op(oldWeight, delta);

        if (pos > 0 && ckpts[pos - 1].fromBlock == block.number) {
            ckpts[pos - 1].balance = newWeight;
        } else {
            ckpts.push(Checkpoint({fromBlock: _safeCastToUint32(block.number), balance: newWeight}));
        }
    }

    function _add(uint256 a, uint256 b) private pure returns (uint256) {
        return a + b;
    }

    function _subtract(uint256 a, uint256 b) private pure returns (uint256) {
        return a - b;
    }

    function _average(uint256 a, uint256 b) internal pure returns (uint256) {
        // (a + b) / 2 can overflow.
        return (a & b) + (a ^ b) / 2;
    }

    function _safeCastToUint32(uint256 number) internal returns (uint32) {
        if (block.number > type(uint32).max) {
            revert InvalidUint32Number(block.number);
        }

        return uint32(number);
    }
}
