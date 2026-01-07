
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StockPosition, InvestmentStrategy, AnalysisResult, SimulationResult } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

// Helper to initialize Gemini
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// Helper for delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- GENERIC AI CALLER (Gemini Only) ---
// Returns both the parsed JSON and the raw response for metadata extraction
const fetchGeminiResponse = async (prompt: string, schema: any, model: string = MODEL_NAME): Promise<{ data: any, response: any }> => {
    const ai = getAiClient();
    let attempts = 0;
    const maxAttempts = 3;

    // Since we cannot use responseMimeType: 'application/json' combined with Tools (googleSearch) on many models,
    // we must instruct the model in the prompt to return strictly formatted JSON.
    const detailedPrompt = `${prompt}
    
    --------------------------------------------------
    IMPORTANT OUTPUT INSTRUCTIONS:
    1. You must return a valid, raw JSON object.
    2. Do NOT wrap the JSON in markdown code blocks (e.g., no \`\`\`json).
    3. Do NOT include comments in the JSON (like // or /* */).
    4. Strictly follow this JSON schema structure:
    ${JSON.stringify(schema, null, 2)}
    --------------------------------------------------
    `;

    while (attempts < maxAttempts) {
        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: detailedPrompt,
                config: {
                    tools: [{ googleSearch: {} }],
                    // responseMimeType and responseSchema are removed to prevent incompatibility with googleSearch tool
                }
            });
            
            let text = response.text || "{}";
            
            // Robust cleanup of markdown if the model disobeys
            text = text.replace(/```json/g, "").replace(/```/g, "").trim();
            
            // Attempt to find the first '{' and last '}' to extract JSON if there's conversational text
            const firstBrace = text.indexOf('{');
            const lastBrace = text.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                text = text.substring(firstBrace, lastBrace + 1);
            }

            // Try to clean potential trailing commas or comments if simple parse fails? 
            // For now, rely on strict prompting.
            
            let data = {};
            try {
                data = JSON.parse(text);
            } catch (jsonError) {
                console.warn("JSON Parse failed on attempt " + attempts, text.substring(0, 100) + "...");
                throw new Error("Invalid JSON format received from AI");
            }
            
            return { data, response };
        } catch (error: any) {
            attempts++;
            
            // Check for Rate Limit (429) or Quota Exceeded
            const isRateLimit = error.status === 429 || 
                                error.message?.includes("429") || 
                                error.message?.includes("quota") ||
                                error.message?.includes("RESOURCE_EXHAUSTED");

            if (isRateLimit && attempts < maxAttempts) {
                const delay = 3000 * attempts; // Backoff
                console.warn(`Gemini Rate Limit hit. Retrying in ${delay}ms... (Attempt ${attempts}/${maxAttempts})`);
                await wait(delay);
                continue;
            }

            console.error("Gemini analysis failed", error);
            
            if (attempts === maxAttempts) {
                throw error;
            }
        }
    }
    throw new Error("Gemini API request failed after multiple retries");
};

export const updateStockPrices = async (portfolio: StockPosition[]): Promise<StockPosition[]> => {
  if (portfolio.length === 0) return [];
  
  const symbols = portfolio.map(s => s.symbol).join(", ");
  const prompt = `
    Find the latest market price (in PKR) and company name for the following stocks on the Pakistan Stock Exchange (PSX): ${symbols}.
    
    Ensure the data is from the most recent trading session available via Google Search.
  `;

  // Schema for prices
  const priceSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      stocks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            currentPrice: { type: Type.NUMBER },
            companyName: { type: Type.STRING },
            sector: { type: Type.STRING }
          }
        }
      }
    }
  };

  try {
    const { data } = await fetchGeminiResponse(prompt, priceSchema, MODEL_NAME);
    const updates = data.stocks || [];

    return portfolio.map(pos => {
      const update = updates.find((u: any) => u.symbol.toUpperCase() === pos.symbol.toUpperCase());
      if (update) {
        return {
          ...pos,
          currentPrice: update.currentPrice || pos.currentPrice,
          companyName: update.companyName || pos.companyName,
          sector: update.sector || pos.sector
        };
      }
      return pos;
    });
  } catch (e) {
    console.warn("Failed to update prices", e);
    // Return original portfolio if update fails so app doesn't crash
    return portfolio;
  }
};

export const generatePortfolioAnalysis = async (
  portfolio: StockPosition[],
  strategy: InvestmentStrategy,
  liquidCash: number,
  onUpdate: (partial: AnalysisResult) => void
): Promise<void> => {
  
  const portfolioSummary = portfolio.length > 0 
    ? portfolio.map(p => `${p.symbol}: ${p.shares} shares @ avg cost ${p.avgBuyPrice}, current ${p.currentPrice}, Sector: ${p.sector}`).join("\n")
    : "No currently held stocks.";

  const strategySummary = `Goal: ${strategy.goal}, Risk Tolerance: ${strategy.riskTolerance}, Horizon: ${strategy.horizonYears} years. Personal Manifesto Notes: "${strategy.notes}"`;

  // --- PHASE 1: TEXT & SENTIMENT ---
  const prompt1 = `
    Act as a senior financial analyst for PSX (Pakistan Stock Exchange).
    
    User Portfolio Holdings:
    ${portfolioSummary}
    
    Available Liquid Cash (PKR): ${liquidCash}
    
    User Strategy:
    ${strategySummary}
    
    Task Phase 1:
    1. Gauge "Internet Opinion" by searching for recent news and forum discussions regarding these specific companies.
    2. Critique strategy alignment. Does the portfolio match the goal?
    3. Suggest new opportunities & threats based on current Pakistan economic conditions.
    4. **CASH DEPLOYMENT PLAYS**: The user has ${liquidCash} PKR in cash. Suggest specific stock buys (either adding to existing or new positions) to utilize this cash effectively based on their strategy. Provide exact symbols and the amount of cash to allocate.
    5. Write an executive summary.
    6. Assign a Health Score (INTEGER 0-100, where 100 is perfect).
    
    CRITICAL: All scores must be INTEGERS between 0 and 100. Do not use decimals (e.g. use 85, not 0.85).
  `;

  const schema1: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      score: { type: Type.NUMBER, description: "Integer between 0 and 100" },
      manifestoAlignmentScore: { type: Type.NUMBER, description: "Integer between 0 and 100" },
      marketSentiment: {
          type: Type.OBJECT,
          properties: {
              overall: { type: Type.STRING, enum: ['Bullish', 'Bearish', 'Neutral'] },
              score: { type: Type.NUMBER, description: "Integer between 0 and 100" },
              internetOpinionSummary: { type: Type.STRING }
          }
      },
      opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
      threats: { type: Type.ARRAY, items: { type: Type.STRING } },
      actionableMoves: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
            symbol: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      },
      recommendedBuys: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            action: { type: Type.STRING, enum: ["INITIATE", "ACCUMULATE"] },
            allocationAmount: { type: Type.NUMBER, description: "Amount in PKR to spend" },
            reason: { type: Type.STRING }
          }
        }
      }
    }
  };

  // --- PHASE 2: DATA & PROJECTIONS & RISK ---
  const prompt2 = `
    Act as a senior quantitative analyst for the Pakistan Stock Exchange (PSX).
    
    Portfolio Data:
    ${portfolioSummary}

    Available Liquid Cash (PKR): ${liquidCash}
    
    User Strategy:
    ${strategySummary}
    
    GENERATE THE FOLLOWING ANALYSIS DATA STRICTLY ADHERING TO THE INSTRUCTIONS:

    1. **Risk Radar**: Score 0-100 for Volatility, Concentration, Liquidity, Dividend Yield, Growth Potential.
    2. **Projected Growth**: Estimate 5-year growth comparison for the Total Net Worth.
       - **Portfolio Strategy**: Project the value of the current stock holdings plus liquid cash (assuming cash is deployed or grows at a base rate).
       - **Market Benchmark**: Assume KSE-100 average return (approx 12-14%).
       - **Bank Savings**: Calculate value if the *entire* net worth (stocks + cash) was liquidated and put into a standard Pakistani high-yield savings account (assume ~18-21% annual return based on current high policy rates in Pakistan).
    3. **Stock Sentiments**: Assign 0-100 score for each stock in portfolio based on recent news.
    
    4. **Correlation Network**: 
       - Identify pairs of stocks in the portfolio.
       - 'strength' must be between 0.1 (low correlation) and 1.0 (high correlation).
       - Stocks in the same sector (e.g., Cement, Oil) MUST have high strength (>0.7).
       - Unrelated sectors should have low strength (<0.3).
       - Only use stock symbols present in the portfolio.

    5. **Drawdown Simulation**: 
       - Simulate a hypothetical 12-month market crash.
       - 'period' should be "Month 1", "Month 2", ... "Month 12".
       - 'marketDrawdown' should follow a curve reaching approx -30% to -40% (e.g. -5, -10, -20, -30, -35...).
       - 'portfolioDrawdown' should be calculated based on the portfolio's beta. High beta (Tech/Cyclical) falls more than market. Low beta (Fertilizer/Power) falls less.
       - ALL drawdown numbers must be NEGATIVE (e.g. -5.5).

    6. **Rolling Factor Exposure**: 
       - Generate data for 4 quarters: "Q1", "Q2", "Q3", "Q4".
       - For each quarter, assign a score (0-100) for: Value, Growth, Momentum, Quality, Volatility.
       - Analyze the stocks: if they are high PE, 'Growth' is high. If high dividend, 'Value' is high.
       - Show logical progression or drift over the quarters.

    7. **Return Attribution**: 
       - Breakdown total return into categories: 'Sector Allocation', 'Security Selection', 'Market Timing', 'Cost Efficiency', 'Currency Effect'.
       - 'contribution' is a percentage (e.g., 2.5 or -1.5).
       - Ensure the values sum up to a realistic total return figure (e.g., between -20 and +40).

    8. **Tail Risk Scenario Analyzer**: 
       - Compare portfolio resilience vs Market in 3 specific scenarios.
       - Scenarios: "2008 Financial Crisis", "COVID-19 Crash", "Inflation Shock (2022)".
       - 'portfolioDecline' and 'marketDecline' MUST be negative numbers.
       - Example: Market -50%, Portfolio -45% (if defensive).
       - 'shockType' describes the nature (e.g., "Systemic Liquidity", "Demand Shock").

    CRITICAL FORMATTING:
    - All scores 0-100 must be Integers.
    - All percentages can be floats.
    - Do not invent stock symbols not listed in Portfolio Data.
  `;

  const schema2: Schema = {
    type: Type.OBJECT,
    properties: {
        dividendForecast: {
            type: Type.OBJECT,
            properties: {
                estimatedAnnualIncome: { type: Type.NUMBER },
                portfolioYield: { type: Type.NUMBER },
                topPayer: { type: Type.STRING }
            }
        },
        riskAssessment: { type: Type.STRING },
        riskRadar: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    A: { type: Type.NUMBER, description: "Integer 0-100" },
                    fullMark: { type: Type.NUMBER }
                }
            }
        },
        projectedGrowth: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    year: { type: Type.STRING },
                    portfolioValue: { type: Type.NUMBER },
                    marketAverage: { type: Type.NUMBER },
                    savingsValue: { type: Type.NUMBER, description: "Hypothetical value if invested in bank savings" }
                }
            }
        },
        stockSentiments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    symbol: { type: Type.STRING },
                    sentimentScore: { type: Type.NUMBER, description: "Integer 0-100" },
                    mentions: { type: Type.STRING }
                }
            }
        },
        correlationAnalysis: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  strength: { type: Type.NUMBER, description: "Float 0.1 to 1.0" }
                }
              }
            }
          }
        },
        drawdownAnalysis: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            simulation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  period: { type: Type.STRING, description: "e.g. Month 1" },
                  portfolioDrawdown: { type: Type.NUMBER, description: "Negative percentage e.g. -5.5" },
                  marketDrawdown: { type: Type.NUMBER, description: "Negative percentage e.g. -10.0" }
                }
              }
            }
          }
        },
        factorAnalysis: {
            type: Type.OBJECT,
            properties: {
                narrative: { type: Type.STRING },
                timeline: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            date: { type: Type.STRING, description: "e.g. Q1" },
                            value: { type: Type.NUMBER, description: "0-100" },
                            growth: { type: Type.NUMBER, description: "0-100" },
                            momentum: { type: Type.NUMBER, description: "0-100" },
                            quality: { type: Type.NUMBER, description: "0-100" },
                            volatility: { type: Type.NUMBER, description: "0-100" }
                        }
                    }
                }
            }
        },
        attributionAnalysis: {
            type: Type.OBJECT,
            properties: {
                narrative: { type: Type.STRING },
                breakdown: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            contribution: { type: Type.NUMBER, description: "Percentage e.g. 2.5" },
                            description: { type: Type.STRING }
                        }
                    }
                }
            }
        },
        tailRiskAnalysis: {
          type: Type.OBJECT,
          properties: {
            narrative: { type: Type.STRING },
            scenarios: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "e.g. 2008 Financial Crisis" },
                  portfolioDecline: { type: Type.NUMBER, description: "Negative Percentage e.g. -45.0" },
                  marketDecline: { type: Type.NUMBER, description: "Negative Percentage e.g. -50.0" },
                  shockType: { type: Type.STRING }
                }
              }
            }
          }
        }
    }
  };

  let currentResult: AnalysisResult = {};
  let allSources: { title: string, uri: string }[] = [];

  // Helper to extract sources
  const extractSources = (response: any) => {
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const found = chunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
      if (found.length > 0) {
          allSources = [...allSources, ...found];
      }
  };

  // Execute Phase 1
  try {
      const { data, response } = await fetchGeminiResponse(prompt1, schema1, MODEL_NAME);
      extractSources(response);
      currentResult = { ...currentResult, ...data, sources: allSources };
      onUpdate(currentResult);
  } catch (e) {
      console.error("Phase 1 analysis failed", e);
      // We don't throw here to allow partial success (or Phase 2 to try)
  }

  // Execute Phase 2
  try {
      const { data, response } = await fetchGeminiResponse(prompt2, schema2, MODEL_NAME);
      extractSources(response);
      
      // Remove duplicate sources
      const uniqueSources = Array.from(new Map(allSources.map(item => [item.uri, item])).values());
      
      currentResult = { ...currentResult, ...data, sources: uniqueSources };
      onUpdate(currentResult);
  } catch (e) {
      console.warn("Phase 2 analysis failed", e);
  }
};

export const simulatePortfolioAddition = async (
    portfolio: StockPosition[],
    newStock: { symbol: string, shares: number, price: number },
    strategy: InvestmentStrategy
): Promise<SimulationResult> => {
    const portfolioSummary = portfolio.map(p => 
        `${p.symbol}: ${p.shares} shares @ ${p.currentPrice || p.avgBuyPrice}`
    ).join("\n");
    
    const strategySummary = `Goal: ${strategy.goal}, Risk: ${strategy.riskTolerance}`;

    const prompt = `
        Act as a portfolio risk manager.
        Current Portfolio:
        ${portfolioSummary}
        
        Proposed Addition:
        Symbol: ${newStock.symbol}
        Shares: ${newStock.shares}
        Price: ${newStock.price}
        
        Strategy: ${strategySummary}
        
        Analyze the impact of this addition.
        1. Will risk increase, decrease, or stay neutral?
        2. How does it affect dividend yield projection?
        3. List pros and cons relative to the strategy.
        4. Provide a summary of the impact.
    `;

    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            impactSummary: { type: Type.STRING },
            riskChange: { type: Type.STRING, enum: ['INCREASE', 'DECREASE', 'NEUTRAL'] },
            projectedYieldChange: { type: Type.STRING },
            pros: { type: Type.ARRAY, items: { type: Type.STRING } },
            cons: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
    };

    const { data } = await fetchGeminiResponse(prompt, schema, MODEL_NAME);
    return data as SimulationResult;
};

export const askAdvisor = async (query: string, portfolio: StockPosition[]): Promise<string> => {
    const portfolioContext = portfolio.map(p => `${p.symbol} (${p.shares} shares)`).join(", ");
    
    const prompt = `
      User Query: "${query}"
      Context: User holds PSX stocks: ${portfolioContext}.
      Provide a helpful, concise answer in Markdown.
    `;

    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
                // No MIME type enforcement needed for chat
            }
        });
        return response.text || "No response.";
    } catch (error) {
        console.warn("Gemini Chat failed", error);
        return "I'm having trouble connecting to my knowledge base right now.";
    }
}
