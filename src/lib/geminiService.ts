import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeTables(tables: string[]): Promise<AnalysisResult> {
  const prompt = `
    Atue como um analista profissional de opções com mais de 20 anos de experiência no mercado financeiro brasileiro.
    Analise as seguintes tabelas de opções usando o modelo RTF-SCA.

    REGRAS DE CÁLCULO:
    1. Base: Preço BID.
    2. Lote padrão: 1000 opções.
    3. Custo Operacional: 0,25% sobre o Volume Total (Strike * 1000 * 0.0025).
    4. Prêmio Mínimo: >= 2% do strike. Calcular e exibir coluna "Prêmio Min (2%)".
    5. Classificar risco: Baixo, Médio, Agressivo.
    6. Tabelas obrigatórias: VENDA DE CALL, VENDA DE PUT, STRANGLE.
    7. Probabilidade ITM: Calcule a probabilidade de exercício (In-The-Money) para cada opção. Retorne SEMPRE como um valor decimal entre 0 e 1 (ex: 0.45 para 45%).
    8. Valor Esperado (EV): Calcule o EV para cada estratégia. 
       - Para Opções (Calls/Puts): EV = Lucro Líquido * (1 - Probabilidade ITM).
       - Para Strangle: EV = Lucro Líquido * Probabilidade de o preço stay between strikes.
    9. Análise de gregas e conclusão.

    CRITÉRIOS DE SELEÇÃO RÍGIDOS:
    1. Extraia EXATAMENTE 3 opções de CALL e 3 opções de PUT que representem os perfis Baixo, Médio e Agressivo.
    2. Ordenação: Em TODAS as tabelas (CALL, PUT e STRANGLE), siga rigorosamente a ordem: Agressivo primeiro, depois Médio, e por fim Baixo.
    3. Seleção Determinística: Priorize ativos com Prêmio (BID) mais próximo do alvo de 2% do strike. Se houver empate, use o de maior liquidez/volume.
    4. Proibição de Hallucinação: Use apenas os dados fornecidos nas tabelas. Não invente símbolos ou prêmios.
    5. Repetitibilidade: Se a entrada for a mesma, a saída DEVE ser rigorosamente a mesma.

    DADOS DAS TABELAS RECEBIDAS:
    ${tables.map((t, i) => `TABELA ${i + 1}:\n${t}`).join('\n\n')}

    Retorne os resultados EXATAMENTE no formato JSON estruturado.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          calls: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { 
                  type: Type.STRING, 
                  description: "Nível de risco: 'Baixo', 'Médio' ou 'Agressivo'",
                  enum: ["Baixo", "Médio", "Agressivo"] 
                },
                symbol: { type: Type.STRING },
                strike: { type: Type.NUMBER },
                premium: { type: Type.NUMBER },
                minPremium2Percent: { type: Type.NUMBER },
                grossRevenue: { type: Type.NUMBER },
                cost: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                returnPercent: { type: Type.NUMBER },
                exerciseProbability: { type: Type.NUMBER },
                expectedValue: { type: Type.NUMBER }
              },
              required: ["risk", "symbol", "strike", "premium", "minPremium2Percent", "grossRevenue", "cost", "netProfit", "returnPercent", "exerciseProbability", "expectedValue"]
            }
          },
          puts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { 
                  type: Type.STRING, 
                  description: "Nível de risco: 'Baixo', 'Médio' ou 'Agressivo'",
                  enum: ["Baixo", "Médio", "Agressivo"] 
                },
                symbol: { type: Type.STRING },
                strike: { type: Type.NUMBER },
                premium: { type: Type.NUMBER },
                minPremium2Percent: { type: Type.NUMBER },
                grossRevenue: { type: Type.NUMBER },
                cost: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                returnPercent: { type: Type.NUMBER },
                exerciseProbability: { type: Type.NUMBER },
                expectedValue: { type: Type.NUMBER }
              },
              required: ["risk", "symbol", "strike", "premium", "minPremium2Percent", "grossRevenue", "cost", "netProfit", "returnPercent", "exerciseProbability", "expectedValue"]
            }
          },
          strangle: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { 
                  type: Type.STRING, 
                  description: "Nível de risco: 'Baixo', 'Médio' ou 'Agressivo'",
                  enum: ["Baixo", "Médio", "Agressivo"] 
                },
                strategy: { type: Type.STRING },
                grossRevenueTotal: { type: Type.NUMBER },
                costTotal: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                returnPercent: { type: Type.NUMBER },
                expectedValue: { type: Type.NUMBER }
              },
              required: ["risk", "strategy", "grossRevenueTotal", "costTotal", "netProfit", "returnPercent", "expectedValue"]
            }
          },
          payoff: {
            type: Type.OBJECT,
            properties: {
              interpretation: { type: Type.STRING },
              profitRegion: { type: Type.STRING },
              breakEvenUpper: { type: Type.NUMBER },
              breakEvenLower: { type: Type.NUMBER },
              idealRange: { type: Type.STRING }
            },
            required: ["interpretation", "profitRegion", "breakEvenUpper", "breakEvenLower", "idealRange"]
          },
          greeks: {
            type: Type.OBJECT,
            properties: {
              delta: { type: Type.STRING },
              gamma: { type: Type.STRING },
              theta: { type: Type.STRING },
              vega: { type: Type.STRING }
            },
            required: ["delta", "gamma", "theta", "vega"]
          },
          conclusion: {
            type: Type.OBJECT,
            properties: {
              bestCall: { type: Type.STRING },
              bestPut: { type: Type.STRING },
              bestStrangle: { type: Type.STRING },
              assetComparison: { type: Type.STRING },
              profileIndication: { type: Type.STRING }
            },
            required: ["bestCall", "bestPut", "bestStrangle", "profileIndication"]
          }
        },
        required: ["calls", "puts", "strangle", "payoff", "greeks", "conclusion"]
      },
      temperature: 0,
    }
  });

  return JSON.parse(response.text || '{}');
}
