const fs = require('fs');
const path = require('path');
const { categorizeError } = require('../src/utils/errorHandler');
const extractor = require('../src/services/extractor');

console.log('🧪 Starting Clean-Up & Restricted Error Tests...\n');

// Test 1: Check deleted files
console.log('--- Test 1: Verification of Deleted Files ---');
const forbiddenFiles = ['.env', '.env.example', 'cookies.txt'];
for (const file of forbiddenFiles) {
  const exists = fs.existsSync(path.resolve(process.cwd(), file));
  if (!exists) {
    console.log(`✅ File "${file}" does not exist.`);
  } else {
    console.error(`❌ Error: File "${file}" still exists!`);
    process.exit(1);
  }
}
console.log('✅ Test 1 Passed.\n');

// Test 2: Verify extractor methods
console.log('--- Test 2: Verification of Extractor Methods ---');
if (typeof extractor.getCookiesPath === 'undefined') {
  console.log('✅ getCookiesPath() is successfully removed.');
} else {
  console.error('❌ Error: getCookiesPath still exists on extractor!');
  process.exit(1);
}

if (typeof extractor.hasCookies === 'undefined') {
  console.log('✅ hasCookies() is successfully removed.');
} else {
  console.error('❌ Error: hasCookies still exists on extractor!');
  process.exit(1);
}

if (typeof extractor.runWithAuthFallback === 'undefined') {
  console.log('✅ runWithAuthFallback() is successfully removed.');
} else {
  console.error('❌ Error: runWithAuthFallback still exists on extractor!');
  process.exit(1);
}
console.log('✅ Test 2 Passed.\n');

// Test 3: Private / Restricted error handling
console.log('--- Test 3: Categorization of Private / Restricted Errors ---');
const restrictedTestCases = [
  'ERROR: [Instagram] This content is unreachable.',
  'ERROR: [Instagram] This account is private. Use --cookies-from-browser or --cookies to authenticate.',
  'ERROR: [youtube] Private video. Sign in if you\'ve been granted access to this video',
  'ERROR: [facebook] Login required. You must log in to continue.',
  'ERROR: [Instagram:story] Please provide cookies to view this story',
  'ERROR: [tiktok] checkpoint_required: user authentication needed',
  'ERROR: [generic] Only available to registered users'
];

const EXPECTED_MSG = 'Tidak dapat mengunduh konten ini karena berasal dari Akun Private, Story yang dibatasi, atau tautan sudah tidak tersedia. Pastikan akun dan postingan bersifat Publik.';

for (const errStr of restrictedTestCases) {
  const categorized = categorizeError({ stderr: errStr });
  if (categorized.code === 'PRIVATE_OR_RESTRICTED' && categorized.status === 403 && categorized.message === EXPECTED_MSG) {
    console.log(`✅ Caught: "${errStr.substring(0, 50)}..." => PRIVATE_OR_RESTRICTED (403)`);
  } else {
    console.error(`❌ Failed on: "${errStr}" => Received:`, categorized);
    process.exit(1);
  }
}
console.log('✅ Test 3 Passed.\n');

console.log('🎉 All Clean-Up & Simplification Tests Passed Successfully!');

