import Wei from '@synthetixio/wei';

// Calculates PD
const calculatePD = (skew: Wei, skewScale: Wei) => skew.div(skewScale);
// Calculates the price with pd applied
const calculateAdjustedPrice = (price: Wei, pd: Wei) => price.add(price.mul(pd));

export function calculateFillPrice(skew: Wei, skewScale: Wei, size: Wei, price: Wei) {
  if (skewScale.eq(0)) {
    return price;
  }
  const pdBefore = calculatePD(skew, skewScale);
  const pdAfter = calculatePD(skew.add(size), skewScale);

  const priceBefore = calculateAdjustedPrice(price, pdBefore);
  const priceAfter = calculateAdjustedPrice(price, pdAfter);

  return priceBefore.add(priceAfter).div(2);
}

export function calculatePricePnl(
  startingSkew: Wei,
  skewScale: Wei,
  size: Wei,
  startingPrice: Wei
) {
  const fillPrice = calculateFillPrice(startingSkew, skewScale, size, startingPrice);
  return startingPrice.sub(fillPrice).mul(size);
}
