/**
 * Impermanent Loss Calculator
 *
 * Calculates IL for liquidity provider positions based on price changes
 */

export interface ILCalculationResult {
  ilPercentage: number;
  ilValue: number;
  currentValue: number;
  holdValue: number;
}

/**
 * Calculate impermanent loss for a 50/50 LP position
 *
 * @param initialPrice - Initial price when position was opened
 * @param currentPrice - Current price
 * @param initialValue - Initial total value of position in USD
 * @returns IL calculation results
 */
export function calculateImpermanentLoss(
  initialPrice: number,
  currentPrice: number,
  initialValue: number
): ILCalculationResult {
  // Price ratio
  const priceRatio = currentPrice / initialPrice;

  // IL formula for 50/50 pools:
  // IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1
  const ilMultiplier = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio);
  const ilPercentage = (ilMultiplier - 1) * 100;

  // Calculate current value and IL in dollars
  const currentValue = initialValue * ilMultiplier;
  const holdValue = initialValue; // If we just held the tokens
  const ilValue = currentValue - holdValue;

  return {
    ilPercentage,
    ilValue,
    currentValue,
    holdValue,
  };
}

/**
 * Estimate IL for a price move (predictive)
 *
 * @param currentPrice - Current price
 * @param predictedPrice - Predicted future price
 * @param positionValue - Current position value in USD
 * @returns Predicted IL
 */
export function predictIL(
  currentPrice: number,
  predictedPrice: number,
  positionValue: number
): ILCalculationResult {
  return calculateImpermanentLoss(currentPrice, predictedPrice, positionValue);
}

/**
 * Calculate price change percentage
 */
export function calculatePriceChange(
  oldPrice: number,
  newPrice: number
): number {
  return ((newPrice - oldPrice) / oldPrice) * 100;
}

/**
 * Calculate if rebalancing is worth it
 * Compares potential IL savings vs gas costs
 */
export function isRebalanceWorthwhile(
  predictedILValue: number,
  estimatedGasCostUSD: number,
  minSavingsMultiplier: number = 10
): boolean {
  const potentialSavings = Math.abs(predictedILValue);
  return potentialSavings > estimatedGasCostUSD * minSavingsMultiplier;
}

/**
 * Example usage and tests
 */
if (require.main === module) {
  // Test case 1: SOL price doubles
  console.log('\\n=== Test 1: Price doubles ===');
  const test1 = calculateImpermanentLoss(100, 200, 10000);
  console.log(`IL: ${test1.ilPercentage.toFixed(2)}%`);
  console.log(`IL Value: $${test1.ilValue.toFixed(2)}`);
  console.log(`Current Value: $${test1.currentValue.toFixed(2)}`);
  console.log(`Hold Value: $${test1.holdValue.toFixed(2)}`);

  // Test case 2: SOL price drops 30%
  console.log('\\n=== Test 2: Price drops 30% ===');
  const test2 = calculateImpermanentLoss(100, 70, 10000);
  console.log(`IL: ${test2.ilPercentage.toFixed(2)}%`);
  console.log(`IL Value: $${test2.ilValue.toFixed(2)}`);

  // Test case 3: Predict IL for 15% price move
  console.log('\\n=== Test 3: Predict 15% price increase ===');
  const test3 = predictIL(100, 115, 10000);
  console.log(`Predicted IL: ${test3.ilPercentage.toFixed(2)}%`);
  console.log(`Predicted IL Value: $${test3.ilValue.toFixed(2)}`);

  // Test case 4: Is rebalancing worthwhile?
  console.log('\\n=== Test 4: Rebalancing decision ===');
  const worthwhile = isRebalanceWorthwhile(250, 2, 10);
  console.log(`$250 IL predicted, $2 gas cost`);
  console.log(`Rebalance worthwhile: ${worthwhile ? 'YES' : 'NO'}`);
}
