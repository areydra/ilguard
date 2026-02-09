/**
 * Risk Scoring Engine
 *
 * Combines IL prediction, position monitoring, and cost analysis
 * to generate actionable risk scores and rebalancing recommendations
 */

import ILPredictor, { ILPrediction } from './ilPredictor';
import PositionMonitor, { LPPosition, PositionUpdate } from './positionMonitor';
import PriceService from './priceService';

export interface RiskScore {
  positionId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100 (100 = most risky)
  components: {
    currentIL: number; // Current IL percentage
    predictedIL: number; // Predicted IL in next 30 min
    outOfRange: boolean;
    volatility: number; // Market volatility
  };
  recommendation: {
    action: 'monitor' | 'widen_range' | 'rebalance' | 'exit';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    reasoning: string;
    expectedSavings: number; // USD
    estimatedGasCost: number; // USD
    worthRebalancing: boolean;
  };
  prediction: ILPrediction | null;
  position: LPPosition;
  timestamp: number;
}

export interface RebalanceDecision {
  shouldRebalance: boolean;
  reason: string;
  expectedILPrevented: number; // USD
  estimatedGasCost: number; // USD
  netSavings: number; // USD
  confidence: number; // 0-100
}

export class RiskScoringEngine {
  private predictor: ILPredictor;
  private monitor: PositionMonitor;
  private priceService: PriceService;

  // Risk weight parameters
  private readonly WEIGHTS = {
    currentIL: 0.3,
    predictedIL: 0.4,
    outOfRange: 0.2,
    volatility: 0.1,
  };

  // Cost parameters
  private readonly GAS_COST_USD = 0.01; // Typical Solana transaction cost
  private readonly MIN_SAVINGS_MULTIPLIER = 10; // Savings must be 10x gas cost

  constructor(priceService: PriceService) {
    this.priceService = priceService;
    this.predictor = new ILPredictor(priceService);
    this.monitor = new PositionMonitor(priceService);
  }

  /**
   * Calculate comprehensive risk score for a position
   */
  async calculateRiskScore(position: LPPosition): Promise<RiskScore> {
    // Get IL prediction
    const prediction = await this.predictor.predictIL(position.tokenA.symbol, {
      timeframeMinutes: 30,
      positionValueUSD: position.totalValueUSD,
      entryPrice: position.currentPrice,
    });

    // Get market volatility
    const volatility = this.priceService.getVolatility(
      `${position.tokenA.symbol}/USD`,
      15
    );

    // Calculate risk components
    const currentILScore = this.normalizeIL(Math.abs(position.currentIL));
    const predictedILScore = prediction
      ? this.normalizeIL(Math.abs(prediction.predictedILPercentage))
      : 0;
    const outOfRangeScore = position.inRange ? 0 : 100;
    const volatilityScore = this.normalizeVolatility(volatility);

    // Calculate weighted risk score
    const riskScore =
      currentILScore * this.WEIGHTS.currentIL +
      predictedILScore * this.WEIGHTS.predictedIL +
      outOfRangeScore * this.WEIGHTS.outOfRange +
      volatilityScore * this.WEIGHTS.volatility;

    // Determine overall risk level
    const overallRisk = this.getRiskLevel(riskScore);

    // Generate rebalancing recommendation
    const recommendation = await this.generateRecommendation(
      position,
      prediction,
      riskScore,
      volatility
    );

    return {
      positionId: position.positionMint,
      overallRisk,
      riskScore: Math.round(riskScore),
      components: {
        currentIL: position.currentIL,
        predictedIL: prediction?.predictedILPercentage || 0,
        outOfRange: !position.inRange,
        volatility,
      },
      recommendation,
      prediction,
      position,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate risk scores for all positions
   */
  async calculateAllRiskScores(): Promise<RiskScore[]> {
    const positions = this.monitor.getAllPositions();
    const scores: RiskScore[] = [];

    for (const position of positions) {
      const score = await this.calculateRiskScore(position);
      scores.push(score);
    }

    // Sort by risk score (highest first)
    return scores.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Decide if rebalancing is worthwhile
   */
  async shouldRebalance(position: LPPosition): Promise<RebalanceDecision> {
    // Get IL prediction
    const prediction = await this.predictor.predictIL(position.tokenA.symbol, {
      timeframeMinutes: 30,
      positionValueUSD: position.totalValueUSD,
      entryPrice: position.currentPrice,
    });

    if (!prediction) {
      return {
        shouldRebalance: false,
        reason: 'Unable to predict IL - insufficient data',
        expectedILPrevented: 0,
        estimatedGasCost: this.GAS_COST_USD,
        netSavings: -this.GAS_COST_USD,
        confidence: 0,
      };
    }

    // Calculate expected IL if no action taken
    const expectedILValue = Math.abs(prediction.predictedILValue);

    // Assume rebalancing prevents 70% of predicted IL
    const ilPrevented = expectedILValue * 0.7;

    // Calculate net savings
    const netSavings = ilPrevented - this.GAS_COST_USD;

    // Decision logic
    const minSavings = this.GAS_COST_USD * this.MIN_SAVINGS_MULTIPLIER;
    const shouldRebalance = ilPrevented > minSavings;

    let reason = '';
    if (shouldRebalance) {
      reason = `Rebalancing will prevent $${ilPrevented.toFixed(2)} IL at $${this.GAS_COST_USD} cost (${(ilPrevented / this.GAS_COST_USD).toFixed(0)}x return)`;
    } else if (expectedILValue < 1) {
      reason = 'Predicted IL is negligible - not worth rebalancing';
    } else {
      reason = `Predicted IL ($${expectedILValue.toFixed(2)}) too small compared to gas cost ($${this.GAS_COST_USD})`;
    }

    return {
      shouldRebalance,
      reason,
      expectedILPrevented: ilPrevented,
      estimatedGasCost: this.GAS_COST_USD,
      netSavings,
      confidence: prediction.confidence,
    };
  }

  /**
   * Generate actionable recommendation
   */
  private async generateRecommendation(
    position: LPPosition,
    prediction: ILPrediction | null,
    riskScore: number,
    volatility: number
  ): Promise<RiskScore['recommendation']> {
    const rebalanceDecision = await this.shouldRebalance(position);

    let action: 'monitor' | 'widen_range' | 'rebalance' | 'exit' = 'monitor';
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let reasoning = '';

    // Critical: Out of range
    if (!position.inRange) {
      action = 'rebalance';
      urgency = 'critical';
      reasoning = `Position OUT OF RANGE. Not earning fees. ${rebalanceDecision.reason}`;
    }
    // Critical: High predicted IL
    else if (prediction && Math.abs(prediction.predictedILPercentage) > 6) {
      action = rebalanceDecision.shouldRebalance ? 'rebalance' : 'exit';
      urgency = 'critical';
      reasoning = `Severe IL predicted (${Math.abs(prediction.predictedILPercentage).toFixed(2)}%). ${rebalanceDecision.reason}`;
    }
    // High: Moderate IL + high volatility
    else if (
      prediction &&
      Math.abs(prediction.predictedILPercentage) > 4 &&
      volatility > 3
    ) {
      action = rebalanceDecision.shouldRebalance ? 'widen_range' : 'monitor';
      urgency = 'high';
      reasoning = `High IL risk (${Math.abs(prediction.predictedILPercentage).toFixed(2)}%) + high volatility. ${rebalanceDecision.reason}`;
    }
    // Medium: Moderate IL
    else if (prediction && Math.abs(prediction.predictedILPercentage) > 2) {
      action = 'monitor';
      urgency = 'medium';
      reasoning = `Moderate IL predicted (${Math.abs(prediction.predictedILPercentage).toFixed(2)}%). Monitor closely.`;
    }
    // Low: Minimal risk
    else {
      action = 'monitor';
      urgency = 'low';
      reasoning = `Position healthy. IL: ${position.currentIL.toFixed(2)}%, Net P&L: $${position.netPnL.toFixed(2)}`;
    }

    return {
      action,
      urgency,
      reasoning,
      expectedSavings: rebalanceDecision.expectedILPrevented,
      estimatedGasCost: rebalanceDecision.estimatedGasCost,
      worthRebalancing: rebalanceDecision.shouldRebalance,
    };
  }

  /**
   * Normalize IL percentage to 0-100 score
   */
  private normalizeIL(ilPercentage: number): number {
    // 0% IL = 0 score
    // 10% IL = 100 score
    return Math.min((ilPercentage / 10) * 100, 100);
  }

  /**
   * Normalize volatility to 0-100 score
   */
  private normalizeVolatility(volatility: number): number {
    // 0% volatility = 0 score
    // 5% volatility = 100 score
    return Math.min((volatility / 5) * 100, 100);
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  /**
   * Get monitor and predictor instances
   */
  getMonitor(): PositionMonitor {
    return this.monitor;
  }

  getPredictor(): ILPredictor {
    return this.predictor;
  }

  /**
   * Format risk score for display
   */
  formatRiskScore(score: RiskScore): string {
    const riskEmoji = {
      low: '✅',
      medium: '⚠️',
      high: '🔶',
      critical: '🚨',
    };

    return `
${riskEmoji[score.overallRisk]} ${score.position.tokenA.symbol}-${score.position.tokenB.symbol} Risk Assessment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk Level: ${score.overallRisk.toUpperCase()} (Score: ${score.riskScore}/100)

Components:
  • Current IL: ${score.components.currentIL.toFixed(2)}%
  • Predicted IL (30min): ${score.components.predictedIL.toFixed(2)}%
  • Out of Range: ${score.components.outOfRange ? 'YES ❌' : 'NO ✅'}
  • Volatility: ${score.components.volatility.toFixed(2)}%

Recommendation:
  Action: ${score.recommendation.action.toUpperCase()}
  Urgency: ${score.recommendation.urgency.toUpperCase()}
  Expected Savings: $${score.recommendation.expectedSavings.toFixed(2)}
  Gas Cost: $${score.recommendation.estimatedGasCost.toFixed(2)}
  Worth Rebalancing: ${score.recommendation.worthRebalancing ? 'YES ✅' : 'NO ❌'}

Reasoning: ${score.recommendation.reasoning}
`;
  }
}

/**
 * Example usage and tests
 */
async function testRiskScoring() {
  console.log('\n=== Testing Risk Scoring Engine ===\n');

  const priceService = new PriceService();
  const riskEngine = new RiskScoringEngine(priceService);

  // Collect price history
  console.log('Collecting price history...');
  for (let i = 0; i < 5; i++) {
    await priceService.getPrice('SOL/USD');
    await priceService.getPrice('USDC/USD');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Test 1: Create mock position
  console.log('\nTest 1: Creating mock position...');
  const monitor = riskEngine.getMonitor();
  const position = monitor.createMockPosition(
    'SOL',
    'USDC',
    100, // Entry at $100
    90,  // Range: $90-$110
    110,
    10000 // $10k position
  );

  // Update position with current prices
  await monitor.updatePosition(position.positionMint);

  // Test 2: Calculate risk score
  console.log('\nTest 2: Calculating risk score...');
  const riskScore = await riskEngine.calculateRiskScore(position);

  console.log(riskEngine.formatRiskScore(riskScore));

  // Test 3: Rebalancing decision
  console.log('\nTest 3: Evaluating rebalancing decision...');
  const decision = await riskEngine.shouldRebalance(position);

  console.log('Rebalancing Decision:');
  console.log(`  Should Rebalance: ${decision.shouldRebalance ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  Reason: ${decision.reason}`);
  console.log(`  Expected IL Prevented: $${decision.expectedILPrevented.toFixed(2)}`);
  console.log(`  Gas Cost: $${decision.estimatedGasCost.toFixed(2)}`);
  console.log(`  Net Savings: $${decision.netSavings.toFixed(2)}`);
  console.log(`  Confidence: ${decision.confidence}%`);

  // Test 4: Multiple scenarios
  console.log('\n\nTest 4: Testing multiple scenarios...');

  const scenarios = [
    { name: 'Stable market', entry: 100, lower: 95, upper: 105 },
    { name: 'Wide range', entry: 100, lower: 80, upper: 120 },
    { name: 'Narrow range', entry: 100, lower: 98, upper: 102 },
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- Scenario: ${scenario.name} ---`);
    const testPos = monitor.createMockPosition(
      'SOL',
      'USDC',
      scenario.entry,
      scenario.lower,
      scenario.upper,
      10000
    );

    await monitor.updatePosition(testPos.positionMint);
    const score = await riskEngine.calculateRiskScore(testPos);

    console.log(`Risk Level: ${score.overallRisk.toUpperCase()} (${score.riskScore}/100)`);
    console.log(`Action: ${score.recommendation.action.toUpperCase()}`);
    console.log(`Reasoning: ${score.recommendation.reasoning}`);
  }

  console.log('\n✅ Risk scoring tests complete!\n');
}

// Run tests if called directly
if (require.main === module) {
  testRiskScoring().catch(console.error);
}

export default RiskScoringEngine;
