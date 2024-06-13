// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

type WeiPrice is uint256;
type GasPrice is uint256;
type Gas is uint256;
type Dollar is uint256;
type Wei is uint256;
type LocalNative is uint256;
type TargetNative is uint256;

// Wei operations
function ltWei(Wei a, Wei b) pure returns (bool) {
    return Wei.unwrap(a) < Wei.unwrap(b);
}

function eqWei(Wei a, Wei b) pure returns (bool) {
    return Wei.unwrap(a) == Wei.unwrap(b);
}

function gtWei(Wei a, Wei b) pure returns (bool) {
    return Wei.unwrap(a) > Wei.unwrap(b);
}

function lteWei(Wei a, Wei b) pure returns (bool) {
    return Wei.unwrap(a) <= Wei.unwrap(b);
}

function subWei(Wei a, Wei b) pure returns (Wei) {
    return Wei.wrap(Wei.unwrap(a) - Wei.unwrap(b));
}

function addWei(Wei a, Wei b) pure returns (Wei) {
    return Wei.wrap(Wei.unwrap(a) + Wei.unwrap(b));
}

function neqWei(Wei a, Wei b) pure returns (bool) {
    return Wei.unwrap(a) != Wei.unwrap(b);
}

// Gas operations
function ltGas(Gas a, Gas b) pure returns (bool) {
    return Gas.unwrap(a) < Gas.unwrap(b);
}

function lteGas(Gas a, Gas b) pure returns (bool) {
    return Gas.unwrap(a) <= Gas.unwrap(b);
}

function subGas(Gas a, Gas b) pure returns (Gas) {
    return Gas.wrap(Gas.unwrap(a) - Gas.unwrap(b));
}

// TargetNative operations
function addTargetNative(TargetNative a, TargetNative b) pure returns (TargetNative) {
    return TargetNative.wrap(TargetNative.unwrap(a) + TargetNative.unwrap(b));
}

function subTargetNative(TargetNative a, TargetNative b) pure returns (TargetNative) {
    return TargetNative.wrap(TargetNative.unwrap(a) - TargetNative.unwrap(b));
}

// LocalNative operations
function addLocalNative(LocalNative a, LocalNative b) pure returns (LocalNative) {
    return LocalNative.wrap(LocalNative.unwrap(a) + LocalNative.unwrap(b));
}

function subLocalNative(LocalNative a, LocalNative b) pure returns (LocalNative) {
    return LocalNative.wrap(LocalNative.unwrap(a) - LocalNative.unwrap(b));
}

function neqLocalNative(LocalNative a, LocalNative b) pure returns (bool) {
    return LocalNative.unwrap(a) != LocalNative.unwrap(b);
}

function leLocalNative(LocalNative a, LocalNative b) pure returns (bool) {
    return LocalNative.unwrap(a) < LocalNative.unwrap(b);
}

function leqLocalNative(LocalNative a, LocalNative b) pure returns (bool) {
    return LocalNative.unwrap(a) <= LocalNative.unwrap(b);
}

// WeiLib Library
library WeiLib {
    using DollarLib for Dollar;
    using GasLib for Gas;

    function min(Wei x, Wei maxVal) internal pure returns (Wei) {
        return Wei.unwrap(x) > Wei.unwrap(maxVal) ? maxVal : x;
    }

    function max(Wei x, Wei maxVal) internal pure returns (Wei) {
        return Wei.unwrap(x) < Wei.unwrap(maxVal) ? maxVal : x;
    }

    function asTargetNative(Wei w) internal pure returns (TargetNative) {
        return TargetNative.wrap(Wei.unwrap(w));
    }

    function asLocalNative(Wei w) internal pure returns (LocalNative) {
        return LocalNative.wrap(Wei.unwrap(w));
    }

    function toDollars(Wei w, WeiPrice price) internal pure returns (Dollar) {
        return Dollar.wrap(Wei.unwrap(w) * WeiPrice.unwrap(price));
    }

    function toGas(Wei w, GasPrice price) internal pure returns (Gas) {
        return Gas.wrap(Wei.unwrap(w) / GasPrice.unwrap(price));
    }

    function scale(Wei w, Gas num, Gas denom) internal pure returns (Wei) {
        return Wei.wrap((Wei.unwrap(w) * Gas.unwrap(num)) / Gas.unwrap(denom));
    }

    function unwrap(Wei w) internal pure returns (uint256) {
        return Wei.unwrap(w);
    }

    function asGasPrice(Wei w) internal pure returns (GasPrice) {
        return GasPrice.wrap(Wei.unwrap(w));
    }

    function convertAsset(
        Wei w,
        WeiPrice fromPrice,
        WeiPrice toPrice,
        uint32 multiplierNum,
        uint32 multiplierDenom,
        bool roundUp
    ) internal pure returns (Wei) {
        Dollar numerator = toDollars(w, fromPrice).mul(multiplierNum);
        WeiPrice denom = WeiPrice.wrap(WeiPrice.unwrap(toPrice) * multiplierDenom);
        Wei res = DollarLib.toWei(numerator, denom, roundUp);
        return res;
    }
}

// GasLib Library
library GasLib {
    using WeiLib for Wei;

    function min(Gas x, Gas maxVal) internal pure returns (Gas) {
        return Gas.unwrap(x) < Gas.unwrap(maxVal) ? x : maxVal;
    }

    function toWei(Gas w, GasPrice price) internal pure returns (Wei) {
        return Wei.wrap(Gas.unwrap(w) * GasPrice.unwrap(price));
    }

    function unwrap(Gas w) internal pure returns (uint256) {
        return Gas.unwrap(w);
    }

    function toGas(Wei w, GasPrice price) internal pure returns (Gas) {
        return Gas.wrap(Wei.unwrap(w) / GasPrice.unwrap(price));
    }
}

// DollarLib Library
library DollarLib {
    using WeiLib for Wei;

    function mul(Dollar a, uint256 b) internal pure returns (Dollar) {
        return Dollar.wrap(Dollar.unwrap(a) * b);
    }

    function toWei(Dollar w, WeiPrice price, bool roundUp) internal pure returns (Wei) {
        return
            Wei.wrap(
                (Dollar.unwrap(w) + (roundUp ? WeiPrice.unwrap(price) - 1 : 0)) /
                    WeiPrice.unwrap(price)
            );
    }

    function toGas(Dollar w, GasPrice price, WeiPrice weiPrice) internal pure returns (Gas) {
        return toWei(w, weiPrice, false).toGas(price);
    }

    function unwrap(Dollar w) internal pure returns (uint256) {
        return Dollar.unwrap(w);
    }
}

// WeiPriceLib Library
library WeiPriceLib {
    function mul(WeiPrice a, uint256 b) internal pure returns (WeiPrice) {
        return WeiPrice.wrap(WeiPrice.unwrap(a) * b);
    }

    function unwrap(WeiPrice w) internal pure returns (uint256) {
        return WeiPrice.unwrap(w);
    }
}

// GasPriceLib Library
library GasPriceLib {
    function priceAsWei(GasPrice w) internal pure returns (Wei) {
        return Wei.wrap(GasPrice.unwrap(w));
    }

    function unwrap(GasPrice w) internal pure returns (uint256) {
        return GasPrice.unwrap(w);
    }
}

// TargetNativeLib Library
library TargetNativeLib {
    function unwrap(TargetNative w) internal pure returns (uint256) {
        return TargetNative.unwrap(w);
    }

    function asNative(TargetNative w) internal pure returns (Wei) {
        return Wei.wrap(TargetNative.unwrap(w));
    }
}

// LocalNativeLib Library
library LocalNativeLib {
    function unwrap(LocalNative w) internal pure returns (uint256) {
        return LocalNative.unwrap(w);
    }

    function asNative(LocalNative w) internal pure returns (Wei) {
        return Wei.wrap(LocalNative.unwrap(w));
    }
}
