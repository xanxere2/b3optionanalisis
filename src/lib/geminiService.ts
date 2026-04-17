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
    7. Análise de gregas e conclusão.

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
                risk: { type: Type.STRING },
                symbol: { type: Type.STRING },
                strike: { type: Type.NUMBER },
                premium: { type: Type.NUMBER },
                minPremium2Percent: { type: Type.NUMBER },
                grossRevenue: { type: Type.NUMBER },
                cost: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                returnPercent: { type: Type.NUMBER },
                exerciseProbability: { type: Type.NUMBER }
              },
              required: ["risk", "symbol", "strike", "premium", "minPremium2Percent", "grossRevenue", "cost", "netProfit", "returnPercent", "exerciseProbability"]
            }
          },
          puts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { type: Type.STRING },
                symbol: { type: Type.STRING },
                strike: { type: Type.NUMBER },
                premium: { type: Type.NUMBER },
                minPremium2Percent: { type: Type.NUMBER },
                grossRevenue: { type: Type.NUMBER },
                cost: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                returnPercent: { type: Type.NUMBER },
                exerciseProbability: { type: Type.NUMBER }
              },
              required: ["risk", "symbol", "strike", "premium", "minPremium2Percent", "grossRevenue", "cost", "netProfit", "returnPercent", "exerciseProbability"]
            }
          },
          strangle: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                risk: { type: Type.STRING },
                strategy: { type: Type.STRING },
                grossRevenueTotal: { type: Type.NUMBER },
                costTotal: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                returnPercent: { type: Type.NUMBER }
              },
              required: ["risk", "strategy", "grossRevenueTotal", "costTotal", "netProfit", "returnPercent"]
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
      }
    }
  });

  return JSON.parse(response.text || '{}');
}
