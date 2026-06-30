/**
 * AI Insights — ports the provider chain from the original ai_insights.py:
 *   1. Google Gemini (free tier)
 *   2. Groq (free tier)
 *   3. Rule-based fallback (always works, no key needed)
 *
 * Unlike the Streamlit version, there's no "secrets don't reach os.environ"
 * problem here — Vercel env vars ARE process.env in Node functions. Just
 * set GEMINI_API_KEY / GROQ_API_KEY in Vercel → Settings → Environment Variables.
 */

const SYSTEM_PROMPT =
  "You are an agricultural market analyst for Indian commodity markets. " +
  "Give clear, practical advice in plain English. " +
  "Keep it under 120 words. No bullet points or headers.";

export function aiProviderStatus(): string {
  if (process.env.GEMINI_API_KEY) return "Google Gemini";
  if (process.env.GROQ_API_KEY) return "Groq (Llama 3.3)";
  return "Rule-based (no GEMINI_API_KEY or GROQ_API_KEY set)";
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.4 },
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      }),
    });
    if (res.status === 200) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p: any) => p.text ?? "").join(" ").trim();
      if (text) return text;
      console.warn("[Gemini] 200 OK but no candidates — possible safety block");
    } else if (res.status === 429) {
      console.warn("[Gemini] Rate limit hit — trying Groq next");
    } else {
      console.warn(`[Gemini] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  } catch (e) {
    console.warn("[Gemini] Error:", e);
  }
  return "";
}

async function callGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.4,
      }),
    });
    if (res.status === 200) {
      const data = await res.json();
      return (data?.choices?.[0]?.message?.content ?? "").trim();
    } else if (res.status === 429) {
      console.warn("[Groq] Rate limit hit — using rule-based fallback");
    } else {
      console.warn(`[Groq] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  } catch (e) {
    console.warn("[Groq] Error:", e);
  }
  return "";
}

export interface PriceContext {
  commodity: string;
  market: string;
  modal: number;
  avg30: number;
  weekChg: number;
  monthChg: number;
  minP: number;
  maxP: number;
}

function ruleBasedInsight(ctx: PriceContext): string {
  const { commodity, modal, avg30, weekChg, minP, maxP } = ctx;
  const spreadPct = modal ? ((maxP - minP) / modal) * 100 : 0;
  const vsAvg = avg30 ? ((modal - avg30) / avg30) * 100 : 0;

  let trend: string, why: string, advice: string;
  if (weekChg > 8) {
    trend = `Prices have risen sharply by ${weekChg.toFixed(1)}% this week.`;
    why = "This likely reflects reduced market arrivals, increased demand from traders, or supply disruption.";
    advice = "If you have stock, this may be a good time to sell at the current high.";
  } else if (weekChg > 3) {
    trend = `Prices are moving up by ${weekChg.toFixed(1)}% this week.`;
    why = "Moderate buying interest in the market. Arrivals may be slightly lower than usual.";
    advice = "Monitor for 2–3 more days. Prices could rise further before correcting.";
  } else if (weekChg < -8) {
    trend = `Prices have dropped sharply by ${Math.abs(weekChg).toFixed(1)}% this week.`;
    why = "Heavy arrivals at the mandi or reduced buyer demand is pushing prices down.";
    advice = "If possible, hold back stock for a few days and watch if prices recover.";
  } else if (weekChg < -3) {
    trend = `Prices are easing down by ${Math.abs(weekChg).toFixed(1)}% this week.`;
    why = "Supply is slightly above demand at current levels.";
    advice = "No immediate action needed. Watch the next 3–5 days for direction.";
  } else {
    trend = `Prices are stable this week (change: ${weekChg >= 0 ? "+" : ""}${weekChg.toFixed(1)}%).`;
    why = "Supply and demand are balanced at current levels.";
    advice = "No urgent action required. Sell when convenient.";
  }

  let avgNote: string;
  if (vsAvg > 10) {
    avgNote = `At ₹${modal.toFixed(0)}, the price is ${vsAvg.toFixed(0)}% above the 30-day average — above normal range.`;
  } else if (vsAvg < -10) {
    avgNote = `At ₹${modal.toFixed(0)}, the price is ${Math.abs(vsAvg).toFixed(0)}% below the 30-day average — below normal range.`;
  } else {
    avgNote = `At ₹${modal.toFixed(0)}, the price is within the normal 30-day range (avg ₹${avg30.toFixed(0)}).`;
  }

  const parts = [trend, why, avgNote, advice];
  if (spreadPct > 15) {
    parts.push(`Today's price spread is wide (₹${minP.toFixed(0)}–₹${maxP.toFixed(0)}), showing price uncertainty.`);
  }
  return parts.join(" ");
}

export async function generatePriceMovementInsight(ctx: PriceContext): Promise<string> {
  const prompt =
    `Commodity: ${ctx.commodity} at ${ctx.market}\n` +
    `Today's modal price: ₹${ctx.modal.toFixed(0)}/quintal\n` +
    `7-day change: ${ctx.weekChg >= 0 ? "+" : ""}${ctx.weekChg.toFixed(1)}%\n` +
    `30-day change: ${ctx.monthChg >= 0 ? "+" : ""}${ctx.monthChg.toFixed(1)}%\n` +
    `30-day average: ₹${ctx.avg30.toFixed(0)}/quintal\n` +
    `7-day price range: ₹${ctx.minP.toFixed(0)} to ₹${ctx.maxP.toFixed(0)}\n\n` +
    `In plain English, explain what is happening with this price and give practical ` +
    `advice to farmers on whether to sell now or wait.`;

  const gemini = await callGemini(prompt);
  if (gemini) return gemini;
  const groq = await callGroq(prompt);
  if (groq) return groq;
  return ruleBasedInsight(ctx);
}

export async function generateMarketSummaryInsight(
  volatile: { commodity_name: string; volatility_pct: number }[]
): Promise<string> {
  const volList = volatile.length
    ? volatile.map((r) => `${r.commodity_name} (${r.volatility_pct.toFixed(0)}% swing)`).join(", ")
    : "data unavailable";
  const prompt =
    `Indian commodity market overview:\n` +
    `Most volatile commodities: ${volList}\n\n` +
    `Write a 2–3 sentence market summary with practical advice for farmers.`;

  const gemini = await callGemini(prompt);
  if (gemini) return gemini;
  const groq = await callGroq(prompt);
  if (groq) return groq;
  if (volatile.length) {
    const top = volatile[0].commodity_name;
    return (
      `Markets are active with ${top} showing the highest price swings this season. ` +
      `Farmers should monitor mandi arrival data and government procurement announcements. ` +
      `Selling in small lots rather than all at once can help manage price risk.`
    );
  }
  return "Market data is being updated. Check back shortly for the latest summary.";
}
