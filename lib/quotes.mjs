export const QUOTE_FIELDS = ["id", "url", "full_sentence", "context", "retrieved_at"];

export function readQuotes(value) {
  if (!Array.isArray(value)) {
    throw new Error("quotes must be an array");
  }
  return value.map((quote, index) => {
    if (quote == null || typeof quote !== "object" || Array.isArray(quote)) {
      throw new Error(`quotes[${index}] must be an object`);
    }
    const out = {};
    for (const field of QUOTE_FIELDS) {
      const text = quote[field];
      if (typeof text !== "string" || text.trim() === "") {
        throw new Error(`quotes[${index}].${field} must be a non-empty string`);
      }
      out[field] = text;
    }
    return out;
  });
}
