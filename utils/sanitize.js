// Lightweight sanitization utility to mitigate stored XSS
// Removes <script> tags and strips all HTML tags; preserves plain text

function stripScripts(input) {
  if (typeof input !== 'string') return input;
  // Remove <script>...</script> blocks (including attributes)
  return input.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
}

function stripTags(input) {
  if (typeof input !== 'string') return input;
  // Remove all HTML tags
  return input.replace(/<[^>]*>/g, '');
}

function collapseWhitespace(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/\s+/g, ' ').trim();
}

function sanitizeText(input) {
  if (input == null) return input;
  let out = String(input);
  out = stripScripts(out);
  out = stripTags(out);
  out = collapseWhitespace(out);
  return out;
}

// Sanitize JSON string fields safely
function sanitizeJsonString(input) {
  if (!input) return undefined;
  const clean = sanitizeText(input);
  return clean || undefined;
}

module.exports = { sanitizeText, sanitizeJsonString };
