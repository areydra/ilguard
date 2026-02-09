/**
 * ILGuard - Integrated Demo
 *
 * Showcases the complete ILGuard system:
 * - Real-time price monitoring
 * - IL prediction
 * - Position monitoring
 * - Risk scoring
 * - Automated alerts
 */

import PriceService from './services/priceService';
import ILPredictor from './services/ilPredictor';
import PositionMonitor from './services/positionMonitor';
import RiskScoringEngine from './services/riskScoring';

// Demo configuration
const DEMO_CONFIG = {
  // Mock position details
  position: {
    pair: 'SOL-USDC',
    entryPrice: 100,     // Entry at $100
    lowerBound: 90,      // Range: $90-$110
    upperBound: 110,
    valueUSD: 10000,     // $10k position
  },
  // How long to monitor
  monitorDurationSeconds: 60,
  // Check interval
  updateIntervalSeconds: 15,
};

async function runDemo() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                  🛡️  ILGuard Demo                    ║');
  console.log('║         Impermanent Loss Protection Agent            ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Initialize services
  console.log('🚀 Initializing ILGuard services...\n');
  const priceService = new PriceService();
  const riskEngine = new RiskScoringEngine(priceService);
  const monitor = riskEngine.getMonitor();
  const predictor = riskEngine.getPredictor();

  // Phase 1: Collect price history
  console.log('📊 Phase 1: Collecting market data...');
  console.log('   (Building price history for accurate predictions)\n');

  for (let i = 0; i < 5; i++) {
    await priceService.getPrice('SOL/USD');
    await priceService.getPrice('USDC/USD');
    process.stdout.write(`   Progress: [${'█'.repeat(i + 1)}${' '.repeat(5 - i - 1)}] ${((i + 1) / 5 * 100).toFixed(0)}%\r`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log('\n   ✅ Price history collected\n');

  // Phase 2: Create mock position
  console.log('📈 Phase 2: Creating liquidity position...');
  const position = monitor.createMockPosition(
    'SOL',
    'USDC',
    DEMO_CONFIG.position.entryPrice,
    DEMO_CONFIG.position.lowerBound,
    DEMO_CONFIG.position.upperBound,
    DEMO_CONFIG.position.valueUSD
  );

  console.log(`   ✅ Position created: ${position.positionMint}`);
  console.log(`   • Pair: ${position.tokenA.symbol}-${position.tokenB.symbol}`);
  console.log(`   • Entry Price: $${position.currentPrice.toFixed(2)}`);
  console.log(`   • Range: $${position.priceLower.toFixed(2)} - $${position.priceUpper.toFixed(2)}`);
  console.log(`   • Total Value: $${position.totalValueUSD.toFixed(2)}\n`);

  // Phase 3: Update position with current market data
  console.log('🔄 Phase 3: Updating position with current market data...');
  const updatedPosition = await monitor.updatePosition(position.positionMint);

  if (updatedPosition) {
    console.log(`   ✅ Position updated`);
    console.log(`   • Current Price: $${updatedPosition.currentPrice.toFixed(2)}`);
    console.log(`   • Current Value: $${updatedPosition.totalValueUSD.toFixed(2)}`);
    console.log(`   • Current IL: ${updatedPosition.currentIL.toFixed(2)}%`);
    console.log(`   • In Range: ${updatedPosition.inRange ? '✅ YES' : '❌ NO'}\n`);
  }

  // Phase 4: Calculate risk score
  console.log('🎯 Phase 4: Calculating comprehensive risk score...');
  const riskScore = await riskEngine.calculateRiskScore(updatedPosition!);

  console.log(riskEngine.formatRiskScore(riskScore));

  // Phase 5: IL Prediction
  console.log('🔮 Phase 5: Predicting future impermanent loss...');
  const prediction = await predictor.predictIL('SOL/USD', {
    timeframeMinutes: 30,
    positionValueUSD: updatedPosition!.totalValueUSD,
    entryPrice: updatedPosition!.currentPrice,
  });

  if (prediction) {
    console.log(`   ✅ IL Prediction (next 30 minutes):`);
    console.log(`   • Predicted Price: $${prediction.predictedPrice.toFixed(2)}`);
    console.log(`   • Predicted IL: ${prediction.predictedILPercentage.toFixed(2)}%`);
    console.log(`   • IL Value: $${prediction.predictedILValue.toFixed(2)}`);
    console.log(`   • Confidence: ${prediction.confidence}%`);
    console.log(`   • Risk Level: ${prediction.riskLevel.toUpperCase()}\n`);
  }

  // Phase 6: Rebalancing decision
  console.log('💡 Phase 6: Evaluating rebalancing decision...');
  const decision = await riskEngine.shouldRebalance(updatedPosition!);

  console.log(`   Decision: ${decision.shouldRebalance ? '✅ REBALANCE' : '⏸️  HOLD'}`);
  console.log(`   Reason: ${decision.reason}`);
  console.log(`   Expected Savings: $${decision.expectedILPrevented.toFixed(2)}`);
  console.log(`   Gas Cost: $${decision.estimatedGasCost.toFixed(2)}`);
  console.log(`   Net Benefit: $${decision.netSavings.toFixed(2)}\n`);

  // Phase 7: Continuous monitoring
  console.log(`🔔 Phase 7: Starting continuous monitoring (${DEMO_CONFIG.monitorDurationSeconds}s)...\n`);

  let updateCount = 0;
  let alertCount = 0;

  const monitoringInterval = monitor.monitorPosition(
    position.positionMint,
    async (update) => {
      updateCount++;

      // Also calculate risk score
      const score = await riskEngine.calculateRiskScore(update.position);

      console.log(`   📊 Update #${updateCount} [${new Date().toLocaleTimeString()}]`);
      console.log(`      Price: $${update.position.currentPrice.toFixed(2)} | IL: ${update.position.currentIL.toFixed(2)}%`);
      console.log(`      Risk: ${score.overallRisk.toUpperCase()} (${score.riskScore}/100)`);
      console.log(`      Action: ${score.recommendation.action.toUpperCase()}`);

      // Alert on high/critical risk
      if (['high', 'critical'].includes(update.urgency)) {
        alertCount++;
        console.log(`      🚨 ALERT: ${update.urgency.toUpperCase()}`);
        console.log(`         ${update.recommendation}\n`);
      } else {
        console.log('');
      }
    },
    DEMO_CONFIG.updateIntervalSeconds
  );

  // Stop monitoring after duration
  setTimeout(async () => {
    clearInterval(monitoringInterval);

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ Demo Complete!\n');

    // Final summary
    const finalPosition = await monitor.updatePosition(position.positionMint);
    const finalRisk = await riskEngine.calculateRiskScore(finalPosition!);

    console.log('📊 Final Summary:');
    console.log(`   • Total Updates: ${updateCount}`);
    console.log(`   • Alerts Triggered: ${alertCount}`);
    console.log(`   • Final IL: ${finalPosition!.currentIL.toFixed(2)}%`);
    console.log(`   • Final Risk: ${finalRisk.overallRisk.toUpperCase()} (${finalRisk.riskScore}/100)`);
    console.log(`   • Net P&L: $${finalPosition!.netPnL.toFixed(2)}\n`);

    console.log('💡 Key Takeaways:');
    console.log(`   • ILGuard successfully monitored your position 24/7`);
    console.log(`   • Real-time IL predictions with ${prediction?.confidence}% confidence`);
    console.log(`   • Automated risk assessment and recommendations`);
    console.log(`   • ${alertCount > 0 ? `${alertCount} alert(s) would have saved you from losses` : 'Position remained healthy throughout'}\n`);

    if (finalRisk.recommendation.worthRebalancing) {
      console.log(`   🎯 Recommended Action: ${finalRisk.recommendation.action.toUpperCase()}`);
      console.log(`      ${finalRisk.recommendation.reasoning}\n`);
    }

    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║    ILGuard: Protecting LPs from Impermanent Loss     ║');
    console.log('║          Built for Colosseum Agent Hackathon         ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    process.exit(0);
  }, DEMO_CONFIG.monitorDurationSeconds * 1000);
}

// Run demo
if (require.main === module) {
  runDemo().catch(error => {
    console.error('\n❌ Demo error:', error);
    process.exit(1);
  });
}

export default runDemo;
