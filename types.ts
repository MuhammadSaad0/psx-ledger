
export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  date: string;
}

export interface StockPosition {
  id: string;
  symbol: string;
  shares: number;
  avgBuyPrice: number;
  currentPrice?: number;
  companyName?: string;
  sector?: string;
  transactions?: Transaction[];
}

export enum InvestmentGoal {
  GROWTH = 'Aggressive Growth',
  DIVIDEND = 'Dividend Income',
  VALUE = 'Value Investing',
  PRESERVATION = 'Capital Preservation',
}

export enum RiskTolerance {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export interface InvestmentStrategy {
  goal: InvestmentGoal;
  riskTolerance: RiskTolerance;
  horizonYears: number;
  notes: string;
  signature?: string;
}

export interface SimulationResult {
  impactSummary: string;
  riskChange: 'INCREASE' | 'DECREASE' | 'NEUTRAL';
  projectedYieldChange: string; // e.g. "+0.2%"
  pros: string[];
  cons: string[];
}

export interface AnalysisResult {
  id?: string;
  timestamp?: number;
  summary?: string;
  score?: number; // 0-100 health score
  manifestoAlignmentScore?: number; // 0-100 how well it fits strategy
  marketSentiment?: {
    overall: 'Bullish' | 'Bearish' | 'Neutral';
    score: number; // 0-100 bullishness
    internetOpinionSummary: string;
  };
  dividendForecast?: {
    estimatedAnnualIncome: number; // Total PKR
    portfolioYield: number; // Percentage
    topPayer: string;
  };
  riskAssessment?: string;
  riskRadar?: {
    subject: string;
    A: number; // Portfolio Score
    fullMark: number;
  }[];
  projectedGrowth?: {
    year: string;
    portfolioValue: number;
    marketAverage: number;
    savingsValue: number; // Comparison with bank savings
  }[];
  projectionNarrative?: string;
  opportunities?: string[];
  threats?: string[];
  actionableMoves?: {
    type: 'BUY' | 'SELL' | 'HOLD';
    symbol: string;
    reason: string;
  }[];
  // New field for Liquid Cash plays
  recommendedBuys?: {
    symbol: string;
    action: 'INITIATE' | 'ACCUMULATE';
    allocationAmount: number; // PKR to spend
    reason: string;
  }[];
  marketContext?: string;
  stockSentiments?: {
    symbol: string;
    sentimentScore: number; // 0-100
    mentions: string; // e.g. "High volume discussion"
  }[];
  correlationAnalysis?: {
    narrative: string;
    links: {
      source: string;
      target: string;
      strength: number; // 0.1 to 1.0
    }[];
  };
  drawdownAnalysis?: {
    narrative: string;
    simulation: {
      period: string;
      portfolioDrawdown: number; // Negative percentage e.g. -5
      marketDrawdown: number; // Negative percentage e.g. -8
    }[];
  };
  // New Fields for Advanced Analytics
  factorAnalysis?: {
    narrative: string;
    timeline: {
      date: string; // e.g. "Q1", "Q2"
      value: number;
      growth: number;
      momentum: number;
      quality: number;
      volatility: number;
    }[];
  };
  attributionAnalysis?: {
    narrative: string;
    breakdown: {
      category: string; // e.g. "Sector Allocation", "Security Selection"
      contribution: number; // percentage e.g. 2.5 or -1.5
      description: string;
    }[];
  };
  tailRiskAnalysis?: {
    narrative: string;
    scenarios: {
      name: string; // e.g., "2008 Crash", "COVID"
      portfolioDecline: number; // Negative number
      marketDecline: number; // Negative number
      shockType: string;
    }[];
  };
  idealAllocation?: {
    symbol: string;
    idealWeight: number; // 0-100
    reason: string;
  }[];
  sources?: {
    title: string;
    uri: string;
  }[];
}

export type TabView = 'dashboard' | 'portfolio' | 'advisor' | 'market';
