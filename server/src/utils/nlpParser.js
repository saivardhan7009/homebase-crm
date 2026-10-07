// src/utils/nlpParser.js
// Rule-based and semantic natural language search query parser

const CITIES = [
  'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi', 'gurgaon', 'gurugram',
  'noida', 'hyderabad', 'pune', 'chennai', 'kolkata', 'ahmedabad', 'jaipur',
  'goa', 'kochi', 'chandigarh', 'navi mumbai', 'thane'
];

const LOCALITIES = [
  'whitefield', 'indiranagar', 'koramangala', 'h抽取sr layout', 'hsr layout',
  'electronic city', 'sarjapur', 'marathahalli', 'bellandur', 'jp nagar',
  'jayanagar', 'bandra', 'andheri', 'juhu', 'worli', 'powai', 'thane west',
  'gachibowli', 'hitec city', 'jubilee hills', 'banjara hills', 'madhapur',
  'wakad', 'hinjewadi', 'baner', 'kothrud', 'vimannagar', 'koregaon park',
  'connaught place', 'saket', 'hauz khas', 'dwarka', 'south extension'
];

const PROPERTY_TYPES = {
  apartment: ['apartment', 'flat', 'condo', 'society'],
  villa: ['villa', 'independent house', 'bungalow', 'row house'],
  house: ['house', 'independent home'],
  plot: ['plot', 'land', 'site'],
  commercial: ['commercial', 'office', 'shop', 'retail', 'warehouse'],
  penthouse: ['penthouse'],
  studio: ['studio', '1rk', 'studio apartment'],
  townhouse: ['townhouse']
};

const AMENITY_MAP = {
  pool: ['pool', 'swimming pool'],
  gym: ['gym', 'fitness', 'workout'],
  parking: ['parking', 'car park', 'garage'],
  furnished: ['furnished', 'fully furnished'],
  pet_friendly: ['pet friendly', 'pets allowed', 'dog friendly'],
  elevator: ['elevator', 'lift'],
  security: ['security', 'cctv', 'gated'],
  garden: ['garden', 'lawn', 'park', 'greenery'],
  balcony: ['balcony', 'terrace']
};

export const parseNaturalLanguageQuery = (queryText) => {
  if (!queryText || typeof queryText !== 'string') {
    return { filters: {}, explanation: 'No search criteria provided.' };
  }

  const text = queryText.toLowerCase();
  const filters = {};
  const extracted = [];

  // 1. Listing Type (Rent vs Buy)
  if (/\b(rent|rental|lease|to rent|for rent)\b/.test(text)) {
    filters.listing_type = 'rent';
    extracted.push('For Rent');
  } else if (/\b(buy|purchase|sale|for sale|to buy)\b/.test(text)) {
    filters.listing_type = 'buy';
    extracted.push('For Sale');
  }

  // 2. Bedrooms (e.g. 1 BHK, 2BHK, 3 BHK, 4 bed, 3 bedroom)
  const bhkMatch = text.match(/(\d+)\s*(?:bhk|bedroom|bed|br)/);
  if (bhkMatch) {
    const beds = parseInt(bhkMatch[1], 10);
    filters.min_beds = beds;
    filters.max_beds = beds;
    extracted.push(`${beds} BHK`);
  }

  // 3. Property Type
  for (const [typeKey, synonyms] of Object.entries(PROPERTY_TYPES)) {
    if (synonyms.some(s => text.includes(s))) {
      filters.property_type = typeKey;
      extracted.push(typeKey.charAt(0).toUpperCase() + typeKey.slice(1));
      break;
    }
  }

  // 4. Price Parsing (Crores, Lakhs, Thousands)
  // Check for "under X Cr", "below X Lakh", "between X and Y"
  const rangeMatch = text.match(/(?:between|from)\s*(?:₹|rs\.?)?\s*([\d.]+)\s*(cr|crore|l|lakh|k)?\s*(?:and|to|-)\s*(?:₹|rs\.?)?\s*([\d.]+)\s*(cr|crore|l|lakh|k)?/i);
  if (rangeMatch) {
    const minVal = parsePriceValue(rangeMatch[1], rangeMatch[2] || rangeMatch[4]);
    const maxVal = parsePriceValue(rangeMatch[3], rangeMatch[4] || rangeMatch[2]);
    if (minVal) filters.min_price = minVal;
    if (maxVal) filters.max_price = maxVal;
    extracted.push(`Price: ₹${rangeMatch[1]} - ₹${rangeMatch[3]}`);
  } else {
    // Check max price: "under 1.5 cr", "below 75 lakhs", "max 2 cr", "less than 50k"
    const maxMatch = text.match(/(?:under|below|less than|max|up to|budget of|within)\s*(?:₹|rs\.?)?\s*([\d.]+)\s*(cr|crore|crores|l|lakh|lakhs|k)?/i);
    if (maxMatch) {
      const maxVal = parsePriceValue(maxMatch[1], maxMatch[2]);
      if (maxVal) {
        filters.max_price = maxVal;
        extracted.push(`Under ₹${formatCleanAmount(maxVal)}`);
      }
    }

    // Check min price: "above 1 cr", "more than 50 lakhs", "min 20k"
    const minMatch = text.match(/(?:above|more than|min|over|at least)\s*(?:₹|rs\.?)?\s*([\d.]+)\s*(cr|crore|crores|l|lakh|lakhs|k)?/i);
    if (minMatch) {
      const minVal = parsePriceValue(minMatch[1], minMatch[2]);
      if (minVal) {
        filters.min_price = minVal;
        extracted.push(`Above ₹${formatCleanAmount(minVal)}`);
      }
    }
  }

  // 5. City & Locality
  for (const city of CITIES) {
    if (text.includes(city)) {
      const normalizedCity = city === 'bengaluru' ? 'Bangalore' :
                             city === 'gurugram' ? 'Gurgaon' :
                             city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      filters.city = normalizedCity;
      extracted.push(`City: ${normalizedCity}`);
      break;
    }
  }

  for (const loc of LOCALITIES) {
    if (text.includes(loc)) {
      filters.search = loc;
      extracted.push(`Area: ${loc.toUpperCase()}`);
      break;
    }
  }

  // 6. Amenities
  for (const [amenityKey, synonyms] of Object.entries(AMENITY_MAP)) {
    if (synonyms.some(s => text.includes(s))) {
      filters[amenityKey] = 'true';
      extracted.push(`Amenity: ${amenityKey.replace('_', ' ')}`);
    }
  }

  // 7. Verified
  if (text.includes('verified') || text.includes('certified')) {
    filters.verified = 'true';
    extracted.push('Verified listings only');
  }

  const explanation = extracted.length > 0
    ? `Identified filters: ${extracted.join(' • ')}`
    : 'No specific filters found; displaying top matches.';

  return { filters, explanation };
};

const parsePriceValue = (numStr, unitStr = '') => {
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;

  const unit = unitStr.toLowerCase();
  if (unit.startsWith('cr')) {
    return Math.round(num * 10000000);
  }
  if (unit.startsWith('l')) {
    return Math.round(num * 100000);
  }
  if (unit === 'k') {
    return Math.round(num * 1000);
  }

  // If no unit is specified:
  // If <= 50 and it's a number like 1.5, 2.5, it's likely Crores
  if (num < 100 && numStr.includes('.')) return Math.round(num * 10000000);
  // If between 100 and 10000, likely Lakhs or monthly rent
  if (num >= 10000) return Math.round(num);

  return Math.round(num);
};

const formatCleanAmount = (amount) => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(2)} L`;
  return amount.toLocaleString('en-IN');
};
