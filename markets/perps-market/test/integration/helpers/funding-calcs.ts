import Wei, { wei } from '@synthetixio/wei';

export function calcCurrentFundingVelocity({
  skew,
  skewScale,
  maxFundingVelocity,
}: {
  skew: Wei;
  skewScale: Wei;
  maxFundingVelocity: Wei;
}) {
  // Avoid a panic due to div by zero. Return 0 immediately.
  if (skewScale.eq(0)) {
    return wei(0);
  }

  // Ensures the proportionalSkew is between -1 and 1.
  const pSkew = wei(skew).div(skewScale);
  const pSkewBounded = Wei.max(Wei.min(pSkew, wei(1)), wei(-1));

  return pSkewBounded.mul(maxFundingVelocity);
}
