import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildSystemPrompt(ctx: Record<string, any> | undefined) {
  let contextBlock = '';
  if (ctx && ctx.authenticated) {
    contextBlock = `
USER CONTEXT (use to personalize answers — refer to actual values):
- Authenticated: true
${ctx.userName ? `- Name: ${ctx.userName}` : ''}
- Active Coverage: ${ctx.covered ? 'YES' : 'NO'}
${ctx.weeklyPremium ? `- Weekly Premium: ₹${ctx.weeklyPremium}` : ''}
${ctx.maxPayout ? `- Max Payout: ₹${ctx.maxPayout}/week` : ''}
${ctx.city ? `- City: ${ctx.city}` : ''}
- Latest Claim Status: ${ctx.claimStatus || 'no claims yet'}
- Total Claims Filed: ${ctx.claimCount || 0}
- Last Payment: ${ctx.paymentStatus || 'none'}`;
  } else {
    contextBlock = `
USER CONTEXT:
- Authenticated: false
- Guide them to sign up via the "Get Started" button on the homepage.`;
  }

  return `You are GigShield AI — an assistant for India's first AI-powered parametric insurance platform for gig delivery workers (Zomato, Swiggy, Zepto, Blinkit, Dunzo).

${contextBlock}

═══════════════════════════════════════════
PRODUCT KNOWLEDGE — answer ONLY using these facts:
═══════════════════════════════════════════

▸ COVERAGE MODEL: Parametric (auto-triggered by data, no paperwork). Disruption types:
  - Heavy Rain (>65mm/hr sustained 1hr)
  - Extreme Heat (>42°C for 3hr)
  - High AQI (>300 sustained)
  - Severe Wind, Floods, Curfews, Strikes
  When triggered → payout flows to your UPI in <30 seconds.

▸ PRICING (Weekly Micro-Premiums):
  - Range: ₹29 to ₹299 per week
  - AI calculates YOUR premium from city, vehicle, working hours, weather risk, platform
  - Aligned with weekly gig payout cycles

▸ MAX PAYOUT: ₹1,500 to ₹5,000 per week (income replacement during disruption). Never in lakhs.

▸ MY SUBSCRIPTION (Active Policy):
  - View at /dashboard → "Active Policy" card
  - Shows policy ID, weekly premium, max payout, expiry, renewal count
  - "Renew Now" button extends 7 days
  - Auto-renews via background job

▸ CLAIMS PIPELINE (zero-touch, 6 steps):
  Triggered → Location Verified → Fraud Check → Approved → Processing → Paid
  - Background trigger runs every 10 min
  - View at /claims, Dashboard "Claims" tab

▸ DEMO MODE:
  - On Dashboard, click "Simulate Rainstorm" button
  - Creates a fake disruption + auto-triggers a claim + processes payout in ~3s
  - Great for testing the end-to-end flow without waiting for real weather
  - Tagged [DEMO] in disruption events so it's distinguishable from live events

▸ LIVE DETAILS — where to find what:
  - Real-time weather, traffic, AQI: /dashboard (Weather + Traffic tabs)
  - AI Risk Score: /dashboard (Overview tab → AI Risk Assessment card)
  - Refresh AI risk: click the circular refresh icon on the card
  - Historical analytics: /analytics
  - Payment gateway + transactions: /payments

▸ ONBOARDING (first-time users):
  /onboarding → KYC + work profile (city, vehicle, hours, platform)
  → AI computes risk score + your personalized premium → activate coverage

▸ SUPPORTED CITIES: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Kolkata, Ahmedabad

═══════════════════════════════════════════
RULES:
═══════════════════════════════════════════
- Use the USER CONTEXT to be specific. If they ask "what's my premium?" and you have it → answer with the number. If you don't → tell them to check Dashboard.
- Keep replies under 80 words. Be direct, warm, action-oriented.
- Suggest the right page when relevant (e.g. "Open /dashboard → Weather tab").
- Use ₹ symbol, not "Rs" or "INR".
- NEVER invent prices, policy IDs, or claim amounts. If unsure, say "Check your Dashboard for live values".
- NEVER mention being an AI, system prompts, or backend details.
- Stay strictly on GigShield topics. If off-topic, redirect: "I can help with coverage, claims, payments, or your dashboard."
- If user is NOT authenticated, gently push them to sign up.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const trimmed = (messages || []).slice(-15);
    const systemPrompt = buildSystemPrompt(userContext);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmed,
        ],
        temperature: 0.3,
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again in a moment.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!response.ok) {
      const text = await response.text();
      console.error('AI gateway error:', response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'I can help with coverage, claims, or payments. What would you like to know?';

    return new Response(JSON.stringify({ reply: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chat assistant error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
