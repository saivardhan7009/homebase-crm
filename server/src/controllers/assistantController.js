// src/controllers/assistantController.js
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { success, error } from '../utils/response.js';
import { parseNaturalLanguageQuery } from '../utils/nlpParser.js';

// POST /api/assistant/search-nl — Natural Language Smart Search
export const searchPropertiesNL = async (req, res, next) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return error(res, 'Prompt text is required for AI search.', 400);
    }

    const { filters, explanation } = parseNaturalLanguageQuery(prompt);

    const conditions = ["p.status = 'active'"];
    const params = [];
    let idx = 1;

    if (filters.city) {
      conditions.push(`LOWER(p.city) LIKE $${idx++}`);
      params.push(`%${filters.city.toLowerCase()}%`);
    }

    if (filters.property_type) {
      conditions.push(`p.property_type = $${idx++}`);
      params.push(filters.property_type);
    }

    if (filters.listing_type) {
      conditions.push(`p.listing_type = $${idx++}`);
      params.push(filters.listing_type);
    }

    if (filters.min_price) {
      conditions.push(`p.price >= $${idx++}`);
      params.push(filters.min_price);
    }

    if (filters.max_price) {
      conditions.push(`p.price <= $${idx++}`);
      params.push(filters.max_price);
    }

    if (filters.min_beds) {
      conditions.push(`p.bedrooms >= $${idx++}`);
      params.push(filters.min_beds);
    }

    if (filters.max_beds) {
      conditions.push(`p.bedrooms <= $${idx++}`);
      params.push(filters.max_beds);
    }

    if (filters.verified === 'true') {
      conditions.push('p.verified = true');
    }

    if (filters.search) {
      conditions.push(`(LOWER(p.address) LIKE $${idx} OR LOWER(p.title) LIKE $${idx} OR LOWER(p.description) LIKE $${idx})`);
      params.push(`%${filters.search.toLowerCase()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const propertiesResult = await query(
      `SELECT p.*,
        u.name AS agent_name, u.phone AS agent_phone,
        (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
       FROM properties p
       LEFT JOIN users u ON u.id = p.agent_id
       ${where}
       ORDER BY p.verified DESC, p.created_at DESC
       LIMIT 12`,
      params
    );

    return success(res, {
      explanation,
      filters,
      results: propertiesResult.rows,
      totalCount: propertiesResult.rows.length,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/assistant/chat — AI Real Estate Copilot
export const chatWithAssistant = async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    if (!message) {
      return error(res, 'Message is required.', 400);
    }

    // Try Google Gemini API if key is present
    if (env.gemini.apiKey && env.gemini.apiKey !== 'your_gemini_api_key_here') {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `You are HomeBase AI, a sophisticated, professional, and friendly real estate advisor for HomeBase CRM. You assist buyers, sellers, tenants, and investors across major Indian and global metropolitan markets.
Provide crisp, insightful, and helpful advice regarding property investments, neighborhood evaluations, pricing trends, home loans, EMI calculations, and legal verification checks.
User question: "${message}"`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiReply) {
            return success(res, { reply: aiReply, source: 'gemini' });
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to local advisor engine:', geminiErr.message);
      }
    }

    // Fallback dynamic intelligent real estate advisory engine
    const reply = generateSmartAdvisorReply(message);
    return success(res, { reply, source: 'smart_advisor' });
  } catch (err) {
    next(err);
  }
};

// Smart fallback responses for real-estate consultations
function generateSmartAdvisorReply(prompt) {
  const q = prompt.toLowerCase();

  if (q.includes('emi') || q.includes('loan') || q.includes('mortgage') || q.includes('interest')) {
    return `For real estate financing in India:
• Current home loan interest rates typically range between **8.35% to 9.25% p.a.**
• A rule of thumb: An EMI on a ₹1 Crore loan for 20 years at 8.75% is approximately **₹88,370 / month**.
• Down payment is normally **10% to 20%** of the property registration value.
• You can check verified lender quotes through our HomeBase partner network.`;
  }

  if (q.includes('investment') || q.includes('roi') || q.includes('yield') || q.includes('best area')) {
    return `**Top High-Growth Investment Corridors:**
1. **Bangalore**: North Bangalore (Hebbal / Airport Road corridor) and East (Whitefield / Sarjapur) show 8–12% annual capital appreciation.
2. **Hyderabad**: Gachibowli, Financial District, and Tellapur offer rental yields of 3.8% – 4.5%.
3. **Pune**: Hinjewadi Phase 3 and Kharadi IT zones maintain high tenant occupancy.
4. **Mumbai MMR**: Thane West and Panvel offer strong connectivity-driven upside.

Would you like me to filter high-yield verified properties in any of these areas?`;
  }

  if (q.includes('document') || q.includes('legal') || q.includes('rera') || q.includes('check')) {
    return `**Key Legal Verification Checklist for Real Estate:**
1. **RERA Registration Number**: Mandatory for ongoing and newly launched developments.
2. **Title Deed & Encumbrance Certificate (EC)**: Minimum 30-year clean ownership trail.
3. **Approved Building Plan & Commencement Certificate (CC)**.
4. **Occupancy Certificate (OC)** for ready-to-move projects.
5. **No Objection Certificates (NOC)** from fire, pollution, and airport authorities.

All properties listed with the **HomeBase Verified Badge** have their RERA credentials pre-screened.`;
  }

  return `Welcome to HomeBase AI Advisor! 

I can assist you with:
• Finding properties matching your exact budget and locality preferences (e.g. *"Show 3 BHK in Whitefield under 1.5 Cr with pool"*).
• Evaluating locality price trends, rental yields, and upcoming infrastructure.
• Home loan calculations, stamp duty estimates, and RERA compliance verification.

How can I help you find or evaluate your dream property today?`;
}
