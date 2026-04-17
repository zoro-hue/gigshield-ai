import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CITY_KEYWORDS: Record<string, string[]> = {
  Mumbai: ['mumbai', 'bombay', 'maharashtra', 'western railway', 'bmc'],
  Delhi: ['delhi', 'new delhi', 'ncr', 'gurugram', 'noida'],
  Bangalore: ['bangalore', 'bengaluru', 'karnataka', 'bbmp'],
  Chennai: ['chennai', 'madras', 'tamil nadu'],
  Hyderabad: ['hyderabad', 'telangana', 'secunderabad'],
  Pune: ['pune', 'pimpri', 'maharashtra'],
  Kolkata: ['kolkata', 'calcutta', 'west bengal'],
  Ahmedabad: ['ahmedabad', 'gujarat', 'gandhinagar'],
};

async function fetchGDELTNews(city: string): Promise<Array<any>> {
  try {
    const keywords = CITY_KEYWORDS[city] || [city.toLowerCase()];
    const query = `(${keywords.join(' OR ')}) (flood OR rain OR strike OR protest OR traffic OR accident OR storm OR heat OR pollution OR bandh OR rally OR waterlogging OR disruption)`;
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=10&format=json&timespan=72h&sourcelang=english`;

    console.log(`[${city}] Fetching GDELT news...`);
    const res = await fetch(url);
    if (res.status !== 200) {
      console.warn(`GDELT API returned status: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const articles = data.articles || [];

    return articles.map((article: any) => {
      const title = article.title || '';
      const lowerTitle = title.toLowerCase();

      let type = 'news';
      let severity = 'moderate';
      if (lowerTitle.includes('flood') || lowerTitle.includes('waterlog') || lowerTitle.includes('rain') || lowerTitle.includes('storm')) {
        type = 'weather'; severity = 'high';
      } else if (lowerTitle.includes('strike') || lowerTitle.includes('bandh') || lowerTitle.includes('protest') || lowerTitle.includes('rally')) {
        type = 'strike'; severity = 'high';
      } else if (lowerTitle.includes('traffic') || lowerTitle.includes('accident') || lowerTitle.includes('jam') || lowerTitle.includes('road')) {
        type = 'traffic'; severity = 'moderate';
      } else if (lowerTitle.includes('heat') || lowerTitle.includes('temperature')) {
        type = 'weather'; severity = 'moderate';
      } else if (lowerTitle.includes('pollution') || lowerTitle.includes('aqi') || lowerTitle.includes('smog')) {
        type = 'pollution'; severity = 'moderate';
      } else if (lowerTitle.includes('curfew') || lowerTitle.includes('section 144')) {
        type = 'curfew'; severity = 'critical';
      }

      if (lowerTitle.includes('dead') || lowerTitle.includes('killed') || lowerTitle.includes('severe') || lowerTitle.includes('emergency')) {
        severity = 'critical';
      }

      return {
        id: crypto.randomUUID(),
        type,
        title: title.length > 100 ? title.substring(0, 100) + '...' : title,
        description: `Source: ${article.domain || 'news'}. ${article.seendate ? `Reported: ${new Date(article.seendate).toLocaleDateString()}` : ''}`,
        city,
        zone: city,
        severity,
        source: 'gdelt_news',
        is_active: true,
        started_at: article.seendate ? new Date(article.seendate).toISOString() : new Date().toISOString(),
        url: article.url || null,
      };
    });
  } catch (e) {
    console.error('GDELT fetch failed:', e);
    return [];
  }
}

// Return existing active disruptions from DB if no fresh news
async function getExistingDisruptions(supabase: any, city: string) {
  const { data } = await supabase
    .from('disruption_events')
    .select('*')
    .eq('city', city)
    .eq('is_active', true)
    .order('started_at', { ascending: false })
    .limit(10);
  return data || [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    const resolvedCity = city || 'Mumbai';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Try GDELT real news first
    let disruptions = await fetchGDELTNews(resolvedCity);
    let source = 'gdelt_news';

    if (disruptions.length > 0) {
      // Deactivate old disruptions for this city
      await supabase.from('disruption_events')
        .update({ is_active: false })
        .eq('city', resolvedCity)
        .eq('source', 'gdelt_news')
        .eq('is_active', true);

      // Insert fresh
      const toInsert = disruptions.map(d => ({
        type: d.type, title: d.title, description: d.description,
        city: d.city, zone: d.zone, severity: d.severity,
        source: d.source, is_active: true,
      }));
      await supabase.from('disruption_events').insert(toInsert);
    } else {
      // No fresh GDELT news — return existing active disruptions from DB
      console.log(`[${resolvedCity}] No GDELT results, returning existing DB disruptions`);
      const existing = await getExistingDisruptions(supabase, resolvedCity);
      disruptions = existing;
      source = existing.length > 0 ? 'database' : 'none';
    }

    return new Response(JSON.stringify({
      disruptions,
      source,
      city: resolvedCity,
      count: disruptions.length,
      generated_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
