const https = require('https');
const express = require('express');
const Report = require('../models/Report');
const { adminOrModerator } = require('../middleware/auth');

const router = express.Router();

// ─── OpenAI API helper ────────────────────────────────────────────────────────
function callOpenAI(userPrompt, systemPrompt = 'You are a helpful chai stall business advisor.', maxTokens = 300) {
  return new Promise((resolve, reject) => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return reject(new Error('OPENAI_API_KEY not configured'));

    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.message?.content;
          if (text) resolve(text.trim());
          else reject(new Error(parsed.error?.message || 'Empty OpenAI response'));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('OpenAI API timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── POST /v1/ai/daily-tip ────────────────────────────────────────────────────
// Returns a contextual tip based on yesterday's report data for the stall.
router.post('/daily-tip', ...adminOrModerator, async (req, res) => {
  try {
    const { stallId } = req.body;

    // Get yesterday's date in YYYY-MM-DD
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const filter = { date: dateStr };
    if (stallId) filter.stallId = stallId;
    const reports = await Report.find(filter).lean();

    if (!reports.length) {
      return res.json({ tip: 'No report data from yesterday yet. Ensure staff submit their daily reports on time.' });
    }

    const totalCups = reports.reduce((s, r) => s + (r.computed?.totalRevenue ? (r.sales?.regularCups || 0) + (r.sales?.specialCups || 0) + (r.sales?.kulhadCups || 0) : 0), 0);
    const totalRevenue = reports.reduce((s, r) => s + (r.computed?.totalRevenue || 0), 0);
    const milkUsed = reports.reduce((s, r) => s + (r.computed?.milkUsed || 0), 0);
    const upiTotal = reports.reduce((s, r) => s + (r.payments?.upi || 0), 0);
    const upiPct = totalRevenue > 0 ? Math.round((upiTotal / totalRevenue) * 100) : 0;
    const allFlags = reports.flatMap(r => (r.flags || []).map(f => f.message));

    const prompt = `Yesterday's chai stall report for ${dateStr}:
- Cups sold: ${totalCups}
- Revenue: ₹${Math.round(totalRevenue)}
- Milk used: ${milkUsed.toFixed(1)} litres
- UPI ratio: ${upiPct}% of payments
- Flags raised: ${allFlags.length > 0 ? allFlags.join('; ') : 'None'}

Write ONE specific, actionable tip for the stall owner in 1-2 sentences. Use the actual numbers. If flags exist, address them directly.`;

    const tip = await callOpenAI(prompt, 'You are a concise chai stall business advisor. Give practical, specific tips based on real data.');
    res.json({ tip });
  } catch (err) {
    console.error('[AI daily-tip]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /v1/ai/flag-narrative ───────────────────────────────────────────────
// Returns a narrative explanation of why a report was flagged.
router.post('/flag-narrative', ...adminOrModerator, async (req, res) => {
  try {
    const { reportId } = req.body;
    if (!reportId) return res.status(400).json({ error: 'reportId required' });

    const report = await Report.findById(reportId).lean();
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!report.flags?.length) return res.json({ narrative: 'No suspicion flags found on this report.' });

    const cups = (report.sales?.regularCups || 0) + (report.sales?.specialCups || 0) + (report.sales?.kulhadCups || 0);
    const revenue = (report.payments?.upi || 0) + (report.payments?.cash || 0);
    const upiPct = revenue > 0 ? Math.round(((report.payments?.upi || 0) / revenue) * 100) : 0;
    const flagList = report.flags.map(f => `• [${f.severity.toUpperCase()}] ${f.message}`).join('\n');

    const prompt = `Analyze these suspicion flags from a chai stall daily report:

Staff: ${report.staffName || 'Unknown'}
Date: ${report.date}
Cups sold: ${cups}
Total collected: ₹${revenue} (UPI: ${upiPct}%)
Expected cups from milk: ${Math.round(report.computed?.expectedCupsFromMilk || 0)}

Flags:
${flagList}

Write a 2-3 sentence analysis explaining what the data suggests and what the admin should investigate. Be factual and neutral.`;

    const narrative = await callOpenAI(prompt, 'You are a chai stall fraud analyst. Be concise, factual, and neutral. Do not make accusations — describe what the data suggests.');
    res.json({ narrative });
  } catch (err) {
    console.error('[AI flag-narrative]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /v1/ai/inventory-alert ─────────────────────────────────────────────
// Returns milk inventory recommendation based on recent usage patterns.
router.post('/inventory-alert', ...adminOrModerator, async (req, res) => {
  try {
    const { stallId } = req.body;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const filter = { submittedAt: { $gte: cutoff } };
    if (stallId) filter.stallId = stallId;

    const reports = await Report.find(filter).sort({ date: -1 }).lean();
    if (!reports.length) {
      return res.json({ alert: 'Not enough report data yet to generate inventory alerts.', milkPacketsNeeded: 0 });
    }

    const totalMilkUsed = reports.reduce((s, r) => s + (r.computed?.milkUsed || 0), 0);
    const avgMilkPerDay = totalMilkUsed / Math.max(reports.length, 1);
    const avgPacketsPerDay = avgMilkPerDay / 0.5; // 500ml per packet

    const latestReport = reports[0];
    const closingMilkLitres = latestReport.closingStock?.milk || 0;
    const closingPacketsEquivalent = closingMilkLitres / 0.5;
    const packetsNeeded = Math.max(0, Math.ceil(avgPacketsPerDay - closingPacketsEquivalent));

    const prompt = `Chai stall inventory data:
- Average milk used per day (last 7 days): ${avgMilkPerDay.toFixed(2)} litres (= ${avgPacketsPerDay.toFixed(1)} packets of 500ml each)
- Current closing stock: ${closingMilkLitres} litres (= ${closingPacketsEquivalent.toFixed(1)} packets)
- Packets needed for tomorrow: ${packetsNeeded}

Write ONE sentence telling the stall owner exactly how many milk packets to buy tomorrow and why. Be specific with numbers.`;

    const alert = await callOpenAI(prompt, 'You are a chai stall inventory manager. Give a single, specific, actionable sentence.');
    res.json({ alert, milkPacketsNeeded: packetsNeeded, avgPacketsPerDay: parseFloat(avgPacketsPerDay.toFixed(1)) });
  } catch (err) {
    console.error('[AI inventory-alert]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /v1/ai/price-optimize ──────────────────────────────────────────────
// Returns price adjustment suggestions based on per-item sales velocity.
router.post('/price-optimize', ...adminOrModerator, async (req, res) => {
  try {
    const { stallId, menuItems } = req.body;
    if (!menuItems?.length) return res.status(400).json({ error: 'menuItems required' });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const filter = { submittedAt: { $gte: cutoff } };
    if (stallId) filter.stallId = stallId;

    const reports = await Report.find(filter).lean();

    // Aggregate cups from the fixed sales fields
    const salesAgg = {
      regularCups: reports.reduce((s, r) => s + (r.sales?.regularCups || 0), 0),
      specialCups: reports.reduce((s, r) => s + (r.sales?.specialCups || 0), 0),
      kulhadCups: reports.reduce((s, r) => s + (r.sales?.kulhadCups || 0), 0),
      vegMomoPackets: reports.reduce((s, r) => s + (r.sales?.vegMomoPackets || 0), 0),
      paneerMomoPackets: reports.reduce((s, r) => s + (r.sales?.paneerMomoPackets || 0), 0),
    };
    const FIELD_MAP = {
      regularChai: 'regularCups',
      specialChai: 'specialCups',
      kulhadChai: 'kulhadCups',
      vegMomo: 'vegMomoPackets',
      paneerMomo: 'paneerMomoPackets',
    };

    const itemLines = menuItems.map(item => {
      // Portioned items arrive as `vegMomo::half` — sales are tracked per item
      const field = FIELD_MAP[item.key.split('::')[0]];
      const qty = field ? salesAgg[field] : 0;
      const unit = field?.includes('Momo') ? 'packets' : 'cups';
      return `- ${item.name}: ${qty} ${unit} sold in last 30 days at ₹${item.price} each`;
    }).join('\n');

    const prompt = `Chai stall menu items with sales data (last 30 days):
${itemLines}
Total report days: ${reports.length}

For each item, suggest a price adjustment. Rules:
- >200 cups: room to raise price by ₹5
- >100 cups: keep price or raise ₹5 if high demand pattern
- <50 cups: consider keeping price or reducing ₹5 to boost sales
- Minimum price ₹10

Respond ONLY with valid JSON array, no extra text:
[{"itemKey":"...","itemName":"...","currentPrice":0,"suggestedPrice":0,"reason":"one short sentence"}]`;

    const raw = await callOpenAI(prompt, 'You are a pricing analyst. Respond only with the JSON array requested, no markdown, no explanation.', 512);

    // Extract JSON from response (Claude may wrap in markdown fences)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse price suggestions' });
    const suggestions = JSON.parse(jsonMatch[0]);
    res.json({ suggestions });
  } catch (err) {
    console.error('[AI price-optimize]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
