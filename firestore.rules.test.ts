import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const securitySpecPath = path.resolve(process.cwd(), 'security_spec.md');

const rules = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  entities: Record<string, { required?: string[]; properties?: Record<string, unknown> }>;
  firestore: Record<string, { schema?: { $ref?: string } }>;
};
const securitySpec = fs.readFileSync(securitySpecPath, 'utf8');

test('firestore.rules enforces Pillar 1 default-deny catch-all and Pillar 3 helpers', () => {
  assert.match(rules, /rules_version\s*=\s*'2'/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
  assert.match(rules, /function isVerifiedUser\(\)\s*\{\s*return isSignedIn\(\) && request\.auth\.token\.email_verified == true;\s*\}/);
  assert.match(rules, /request\.auth\.token\.email == 'karnajoydas@gmail\.com'/);
  assert.equal(rules.includes('gamernortheast10@gmail.com'), false);
});

test('Dirty Dozen security invariants are explicitly enforced across all collections', () => {
  // 1 & 2 & 12: PII isolation under /users/{userId}/private and /transactions list scoped to owner/admin
  assert.match(rules, /match \/private\/\{docId\}/);
  assert.match(rules, /match \/\{path=\*\*\}\/private\/\{docId\}/);
  assert.match(rules, /allow get: if isValidId\(userId\) && isValidId\(docId\) && \(isOwner\(userId\) \|\| isAdmin\(\)\);/);
  assert.match(rules, /allow list: if isOwnerTokenAdmin\(\) \|\| \(isVerifiedUser\(\) && existing\(\)\.uid == request\.auth\.uid\);/);

  // 3: Email verification required for admin & user mutations
  assert.match(rules, /function isAdmin\(\)\s*\{\s*return isVerifiedUser\(\)/);

  // 4: Self-assigned admin escalation blocked (/admins write false)
  assert.match(rules, /match \/admins\/\{userId\}\s*\{[\s\S]*?allow list, create, update, delete:\s*if false;/);

  // 5: Strict schema enforcement (hasAll + hasOnly) on all entities
  assert.ok(rules.includes("data.keys().hasAll(['uid', 'displayName', 'referralCode', 'createdAt', 'updatedAt'])"));
  assert.ok(rules.includes("data.keys().hasOnly(['uid', 'displayName', 'referralCode', 'createdAt', 'updatedAt'])"));
  assert.ok(rules.includes('data.keys().hasOnly(['));

  // 6: Path ID bounds & character checks
  assert.ok(rules.includes('id.size() >= 1 && id.size() <= 128'));

  // 7: Zero initial balance & non-admin blocked from mutating balance or referralRewardSettled
  assert.ok(rules.includes('incoming().balance == 0'));
  assert.ok(rules.includes('incoming().withdrawableBalance == 0'));
  assert.ok(rules.includes('incoming().referralRewardSettled == false'));
  assert.ok(rules.includes('incoming().deactivated == false'));
  assert.ok(rules.includes("'lastLoginAtMs'"));

  // 8: Terminal bet outcome mutation blocked for non-admins and post-settlement
  assert.ok(rules.includes("incoming().status == 'open'"));
  assert.ok(rules.includes("existing().status == 'open'"));

  // 9 & 10: Server timestamps & immutable uid/createdAt
  assert.ok(rules.includes('incoming().createdAt == request.time'));
  assert.ok(rules.includes('incoming().updatedAt == request.time'));
  assert.ok(rules.includes('incoming().uid == existing().uid'));
  assert.ok(rules.includes('incoming().createdAt == existing().createdAt'));

  // 11: Markets collection restricted to admin writes
  assert.match(rules, /match \/markets\/\{marketId\}[\s\S]*?allow create:[\s\S]*?isAdmin\(\)/);
});

test('firebase-blueprint.json and security_spec.md align with firestore.rules collections', () => {
  const expectedCollections = [
    '/users/{userId}',
    '/users/{userId}/private/{docId}',
    '/users/{userId}/bets/{betId}',
    '/users/{userId}/transactions/{txId}',
    '/markets/{marketId}',
    '/admins/{userId}',
  ];
  for (const col of expectedCollections) {
    assert.ok(blueprint.firestore[col], `Missing ${col} in firebase-blueprint.json`);
  }
  assert.ok(securitySpec.includes('Dirty Dozen Payloads'));
});
