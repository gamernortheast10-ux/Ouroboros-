# Ouroboros Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unspecified paths under `/databases/{database}/documents` reject read and write requests.
2. **PII Isolation**: Email, phone number, wallet balance, and referral credit fields reside strictly inside `/users/{userId}/private/{docId}`, readable only by the authenticated verified owner (`request.auth.uid == userId`) or verified Admin.
3. **Identity & Privilege Integrity**: Users cannot assign themselves admin roles (`/admins/{userId}` writes are denied), cannot spoof another UID (`data.uid == request.auth.uid`), and cannot inflate balances or mutate terminal bet outcomes (`status: 'won' | 'lost'`) directly.
4. **Verified Email Requirement**: Standard read/write rules require `request.auth != null && request.auth.token.email_verified == true`.
5. **Strict Schema & Bounds**: Every write validates required/allowed keys (`hasAll` + `hasOnly`), string `.size()` bounds, regex path IDs (`^[a-zA-Z0-9_\-]+$`), immutable `uid`/`createdAt`, and server timestamps (`request.time`).
6. **Secure List Queries**: `allow list` rules evaluate `resource.data` directly (e.g., `resource.data.uid == request.auth.uid` or `resource.data.isActive == true`) without `get()`/`exists()` loops.

## 2. Dirty Dozen Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated read of private wallet**: `GET /users/uid_1/private/account` with `auth = null`.
2. **Cross-user PII peek**: `GET /users/uid_2/private/account` authenticated as `uid_1`.
3. **Unverified email admin spoof**: `CREATE /markets/mkt_1` with `email = 'karnajoydas@gmail.com'`, `email_verified = false`.
4. **Self-assigned admin escalation**: `CREATE /admins/uid_1` with `{ uid: 'uid_1', role: 'owner' }`.
5. **Shadow ghost field injection**: `CREATE /users/uid_1` with `{ uid: 'uid_1', displayName: 'Test', referralCode: 'OURO-1234', createdAt: now, updatedAt: now, isAdmin: true }`.
6. **ID poisoning with invalid chars / >128 bytes**: `CREATE /users/bad$id_150...` with invalid document ID.
7. **Self-credit balance tampering on update**: `UPDATE /users/uid_1/private/account` modifying `balance` or `referralRewardSettled` as non-admin owner.
8. **Terminal bet outcome mutation**: `UPDATE /users/uid_1/bets/bet_1` changing `status` from `'won'` back to `'open'` as non-admin.
9. **Spoofed client timestamp**: `CREATE /users/uid_1` with `createdAt` different from `request.time`.
10. **Immutable field tampering**: `UPDATE /users/uid_1` changing `uid` or `createdAt`.
11. **Non-admin market creation**: `CREATE /markets/mkt_evil` by regular verified user.
12. **Blanket list scrape on private transactions**: `LIST /users/uid_2/transactions` authenticated as `uid_1`.
