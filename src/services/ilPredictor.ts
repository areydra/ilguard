/**
 * IL Prediction Engine
 *
 * Predicts impermanent loss 15-30 minutes before it happens
 * Uses price velocity and volatility to forecast price movements
 */

import PriceService, { PriceVelocity } from './priceService';
import { calculateImpermanentLoss, predictIL } from '../utils/ilCalculator';

export interface ILPrediction {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  predictionTimeframe: number; // minutes
  predictedILPercentage: number;
  predictedILValue: number;
  confidence: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface PredictionConfig {
  timeframeMinutes: number; // How far ahead to predict (default: 30)
  positionValueUSD: number;
  entryPrice: number;
}

export class ILPredictor {
  private priceService: PriceService;

  // Prediction model parameters
  private readonly VOLATILITY_WEIGHT = 0.4;
  private readonly VELOCITY_WEIGHT = 0.6;

  // Risk thresholds
  private readonly RISK_THRESHOLDS = {
    low: 2,      // < 2% predicted IL
    medium: 4,   // 2-4% predicted IL
    high: 6,     // 4-6% predicted IL
    critical: 6  // > 6% predicted IL
  };

  constructor(priceService: PriceService) {
    this.priceService = priceService;
  }

  /**
   * Predict IL for a liquidity position
   */
  async predictIL(
    symbol: string,
    config: PredictionConfig
  ): Promise<ILPrediction | null> {
    // Get current price
    const priceData = await this.priceService.getPrice(symbol);
    if (!priceData) {
      console.error(`Failed to fetch price for ${symbol}`);
      return null;
    }

    // Get price velocity
    const velocity = this.priceService.getPriceVelocity(symbol);
    if (!velocity) {
      console.error(`Not enough price history for ${symbol}`);
      return null;
    }

    // Get volatility
    const volatility = this.priceService.getVolatility(symbol, config.timeframeMinutes);

    // Predict future price based on velocity and volatility
    const { predictedPrice, confidence } = this.predictFuturePrice(
      priceData.price,
      velocity,
      volatility,
      config.timeframeMinutes
    );

    // Calculate predicted IL
    const ilResult = predictIL(
      config.entryPrice,
      predictedPrice,
      config.positionValueUSD
    );

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(Math.abs(ilResult.ilPercentage));

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      riskLevel,
      ilResult.ilPercentage,
      velocity
    );

    return {
      symbol,
      currentPrice: priceData.price,
      predictedPrice,
      predictionTimeframe: config.timeframeMinutes,
      predictedILPercentage: ilResult.ilPercentage,
      predictedILValue: ilResult.ilValue,
      confidence,
      riskLevel,
      recommendation,
    };
  }

  /**
   * Predict future price based on velocity and volatility
   */
  private predictFuturePrice(
    currentPrice: number,
    velocity: PriceVelocity,
    volatility: number,
    timeframeMinutes: number
  ): { predictedPrice: number; confidence: number } {
    // Calculate expected price change based on velocity
    const hourlyChange = velocity.velocityPerHour;
    const expectedChange = (hourlyChange / 60) * timeframeMinutes;

    // Adjust for volatility (higher volatility = less confident prediction)
    // Volatility acts as a uncertainty multiplier
    const volatilityFactor = Math.min(volatility / 10, 1); // Cap at 1

    // Weighted prediction
    const velocityPrediction = currentPrice * (1 + expectedChange / 100);

    // Add volatility-based adjustment
    // Higher volatility means price could move more than velocity suggests
    const volatilityAdjustment = currentPrice * (volatility / 100) * (expectedChange > 0 ? 1 : -1);

    const predictedPrice =
      velocityPrediction * this.VELOCITY_WEIGHT +
      (velocityPrediction + volatilityAdjustment) * this.VOLATILITY_WEIGHT;

    // Calculate confidence score (0-100)
    // Lower volatility = higher confidence
    // More price history = higher confidence
    const historyFactor = Math.min(this.priceService.getHistorySize(velocity.symbol) / 50, 1);
    const volatilityConfidence = Math.max(0, 100 - volatility * 5);
    const confidence = volatilityConfidence * historyFactor;

    return {
      predictedPrice: Math.max(predictedPrice, 0), // Ensure non-negative
      confidence: Math.round(confidence)
    };
  }

  /**
   * Calculate risk level based on predicted IL
   */
  private calculateRiskLevel(ilPercentage: number): 'low' | 'medium' | 'high' | 'critical' {
    const absIL = Math.abs(ilPercentage);

    if (absIL < this.RISK_THRESHOLDS.low) return 'low';
    if (absIL < this.RISK_THRESHOLDS.medium) return 'medium';
    if (absIL < this.RISK_THRESHOLDS.high) return 'high';
    return 'critical';
  }

  /**
   * Generate actionable recommendation
   */
  private generateRecommendation(
    riskLevel: string,
    ilPercentage: number,
    velocity: PriceVelocity
  ): string {
    const absIL = Math.abs(ilPercentage);
    const direction = velocity.velocityPerHour > 0 ? 'upward' : 'downward';

    switch (riskLevel) {
      case 'low':
        return `Low risk (${absIL.toFixed(2)}% IL). Position is safe. Continue monitoring.`;

      case 'medium':
        return `Medium risk (${absIL.toFixed(2)}% IL). Consider widening range if ${direction} trend continues.`;

      case 'high':
        return `High risk (${absIL.toFixed(2)}% IL)! Recommend widening range now to reduce IL exposure.`;

      case 'critical':
        return `CRITICAL RISK (${absIL.toFixed(2)}% IL)! Strong ${direction} movement detected. Consider exiting position or immediately widening range.`;

      default:
        return 'Unable to determine recommendation.';
    }
  }

  /**
   * Batch predict IL for multiple positions
   */
  async predictMultiple(
    positions: Array<{ symbol: string; config: PredictionConfig }>
  ): Promise<Array<ILPrediction | null>> {
    const predictions = await Promise.all(
      positions.map(pos => this.predictIL(pos.symbol, pos.config))
    );
    return predictions;
  }

  /**
   * Monitor a position continuously and alert on high risk
   */
  async monitorPosition(
    symbol: string,
    config: PredictionConfig,
    onRiskDetected: (prediction: ILPrediction) => void,
    intervalSeconds: number = 30
  ): Promise<void> {
    const monitor = async () => {
      const prediction = await this.predictIL(symbol, config);

      if (prediction && ['high', 'critical'].includes(prediction.riskLevel)) {
        onRiskDetected(prediction);
      }
    };

    // Run immediately
    await monitor();

    // Then run on interval
    setInterval(monitor, intervalSeconds * 1000);
  }
}

/**
 * Example usage and tests
 */
async function testILPredictor() {
  console.log('\n=== Testing IL Predictor ===\n');

  const priceService = new PriceService();
  const predictor = new ILPredictor(priceService);

  // Collect some price history first
  console.log('Collecting price history...');
  for (let i = 0; i < 5; i++) {
    await priceService.getPrice('SOL/USD');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  }

  // Test prediction
  console.log('\nTest 1: Predict IL for SOL-USDC position');
  const prediction = await predictor.predictIL('SOL/USD', {
    timeframeMinutes: 30,
    positionValueUSD: 10000,
    entryPrice: 100, // Assume entry at $100
  });

  if (prediction) {
    console.log('✅ Prediction Results:');
    console.log(`   Current Price: $${prediction.currentPrice.toFixed(2)}`);
    console.log(`   Predicted Price (30min): $${prediction.predictedPrice.toFixed(2)}`);
    console.log(`   Predicted IL: ${prediction.predictedILPercentage.toFixed(2)}%`);
    console.log(`   IL Value: $${prediction.predictedILValue.toFixed(2)}`);
    console.log(`   Confidence: ${prediction.confidence}%`);
    console.log(`   Risk Level: ${prediction.riskLevel.toUpperCase()}`);
    console.log(`   Recommendation: ${prediction.recommendation}`);
  } else {
    console.log('❌ Prediction failed');
  }

  // Test monitoring
  console.log('\nTest 2: Monitoring position for 30 seconds...');
  let alertCount = 0;

  setTimeout(() => {
    console.log(`\n✅ Monitoring complete. Alerts triggered: ${alertCount}`);
    process.exit(0);
  }, 30000);

  await predictor.monitorPosition(
    'SOL/USD',
    {
      timeframeMinutes: 15,
      positionValueUSD: 10000,
      entryPrice: 100,
    },
    (pred) => {
      alertCount++;
      console.log(`   🚨 ALERT: ${pred.riskLevel.toUpperCase()} risk detected!`);
      console.log(`      ${pred.recommendation}`);
    },
    10 // Check every 10 seconds
  );
}

// Run tests if called directly
if (require.main === module) {
  testILPredictor().catch(console.error);
}

export default ILPredictor;
