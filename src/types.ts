export type SystemStatus = 'initial' | 'collecting' | 'complete' | 'analysed' | 'error';

export interface OptionData {
  risk: 'Baixo' | 'Médio' | 'Agressivo';
  symbol: string;
  strike: number;
  premium: number;
  minPremium2Percent: number;
  grossRevenue: number;
  cost: number;
  netProfit: number;
  returnPercent: number;
  exerciseProbability: number;
  expectedValue: number;
}

export interface StrangleData {
  risk: 'Baixo' | 'Médio' | 'Agressivo';
  strategy: string; // codes like "CALL + PUT"
  grossRevenueTotal: number;
  costTotal: number;
  netProfit: number;
  returnPercent: number;
  expectedValue: number;
}

export interface AnalysisResult {
  calls: OptionData[];
  puts: OptionData[];
  strangle: StrangleData[];
  payoff: {
    interpretation: string;
    profitRegion: string;
    breakEvenUpper: number;
    breakEvenLower: number;
    idealRange: string;
  };
  greeks: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
  };
  conclusion: {
    bestCall: string;
    bestPut: string;
    bestStrangle: string;
    assetComparison?: string;
    profileIndication: 'Conservador' | 'Moderado' | 'Agressivo';
  };
}
