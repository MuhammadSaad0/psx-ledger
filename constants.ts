import { InvestmentGoal, InvestmentStrategy, RiskTolerance, StockPosition } from './types';

export const INITIAL_STRATEGY: InvestmentStrategy = {
  goal: InvestmentGoal.GROWTH,
  riskTolerance: RiskTolerance.MEDIUM,
  horizonYears: 5,
  notes: "Looking to beat inflation and save for a house down payment.",
};

export const INITIAL_PORTFOLIO: StockPosition[] = [];

export const MOCK_ANALYSIS_MARKDOWN = `
## Portfolio Health Check
**Score: 78/100**

Your portfolio is well-positioned for growth, with a strong tilt towards the Technology and Energy sectors.

### Risk Assessment
*   **Concentration Risk**: High. 40% of your capital is in a single sector.
*   **Market Risk**: Moderate. PSX volatility is currently elevated.

### Actionable Moves
*   **BUY**: Consider adding **ENGRO** to diversify into fertilizers.
*   **HOLD**: Keep **OGDC** as oil prices stabilize.
*   **SELL**: Trim **LUCK** if it drops below 700 to stop losses.
`;