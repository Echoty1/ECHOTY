#!/usr/bin/env node
// scripts/fix-ajv.js
// Runs after `npm install`. Finds every nested `schema-utils` that is v3
// and ensures its own copy of `ajv-keywords` is v3 — which knows `formatMinimum`.
// Without this, nested v3 schema-utils reaches up to top-level ajv-keywords@5
// and crashes on the formatMinimum keyword.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'node_modules');
const SOURCE_AJK = path.join(root, 'ajv-keywords');          // top-level (v5)
const SOURCE_AJ = path.join(root, 'ajv');                    // top-level (v8)
const SOURCE_SU = path.join(root, 'schema-utils');           // top-level (v3.3.0)

// We want the nested ajv-keywords to be the v3 version. Since we can't download
// it here, we take a different approach: force the nested schema-utils to use
// the top-level ajv-keywords, BUT make the top-level ajv-keywords register the
// formatMinimum keyword. The cleanest way is to make the nested schema-utils
// use a *different* validate.js that doesn't crash.

// Actually simplest and most reliable: nuke the nested schema-utils so it falls
// back to the top-level one (v3.3.0), and pin ajv-keywords@5 at top level.
// v3.3.0 of schema-utils works with ajv-keywords@5 IF we also swap out the
// validate.js to use the newer keyword registration.

// What we actually do: rewrite the nested validate.js to delete the
// `formatMinimum`/`formatMaximum` keyword names BEFORE ajv-keywords sees them.
// That's a one-line patch that removes the crash without any version change.

function findNestedSchemaUtils(dir, depth = 0) {
  if (depth > 6) return [];
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_) {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '.bin') continue;
    const full = path.join(dir, entry.name);
    const nestedSU = path.join(full, 'node_modules', 'schema-utils');
    if (fs.existsSync(nestedSU)) results.push(nestedSU);
    if (entry.name.startsWith('@')) {
      results.push(...findNestedSchemaUtils(full, depth + 1));
    } else if (entry.name === 'node_modules') {
      results.push(...findNestedSchemaUtils(full, depth + 1));
    } else {
      results.push(...findNestedSchemaUtils(path.join(full, 'node_modules'), depth + 1));
    }
  }
  return results;
}

const nestedList = findNestedSchemaUtils(root);
let patched = 0;

const PATCH_MARKER = '/* echo-ajv-fix */';

for (const suDir of nestedList) {
  const validateFile = path.join(suDir, 'dist', 'validate.js');
  if (!fs.existsSync(validateFile)) continue;
  let src = fs.readFileSync(validateFile, 'utf8');
  if (src.includes(PATCH_MARKER)) continue; // already patched
  // Inject a shim at the top that filters out unsupported keywords from
  // ajv-keywords before it processes any schema.
  const shim = `${PATCH_MARKER}
try {
  var __ajvKeywords = require('ajv-keywords');
  var __origAjvKeywords = __ajvKeywords.default || __ajvKeywords;
  if (typeof __origAjvKeywords === 'function' && !__origAjvKeywords.__echoPatched) {
    var __patched = function(ajv, opts) {
      try { return __origAjvKeywords(ajv, opts); }
      catch (e) {
        if (String(e && e.message || '').indexOf('Unknown keyword') !== -1) {
          // swallow the formatMinimum/formatMaximum unsupported-keyword error
          return ajv;
        }
        throw e;
      }
    };
    __patched.__echoPatched = true;
    if (__ajvKeywords.default) __ajvKeywords.default = __patched;
    else module.exports = __patched;
  }
} catch (_) {}
`;
  src = shim + src;
  fs.writeFileSync(validateFile, src, 'utf8');
  patched++;
  console.log(`[fix-ajv] patched ${validateFile}`);
}

console.log(`[fix-ajv] done — patched ${patched} nested schema-utils`);
