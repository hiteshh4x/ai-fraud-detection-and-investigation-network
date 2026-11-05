# Security Specification & Red Team Audit (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: All unspecified paths under `/databases/{database}/documents/{document=**}` are unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Zero PII Exposure**: `/users/{userId}` stores only non-PII analyst metadata (`uid`, `displayName`, `clearanceTier`, `createdAt`) and restricts read/write strictly to the owner (`userId == request.auth.uid`).
4. **Strict Ownership & Query Enforcement**: `/ledger_entries/{entryId}` and `/forensic_reports/{reportId}` enforce `resource.data.ownerId == request.auth.uid` on both `get` and `list`, preventing unauthorized cross-tenant query scraping.
5. **Action-Based Updates & Terminal State Locking**: Once a `LedgerEntry` reaches terminal status `SETTLED`, no further updates are permitted (`existing().status != 'SETTLED'`). Updates are constrained via `incoming().diff(existing()).affectedKeys().hasOnly(['status', 'riskLevel', 'riskScore', 'threatVector', 'updatedAt'])`.
6. **Temporal Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`. `updatedAt` must equal `request.time` on both `create` and `update`.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Shadow Field Injection)**: `LedgerEntry` create containing `"isVerifiedAdmin": true` -> Rejected by `data.keys().hasOnly(...)`.
2. **Payload 2 (Identity Spoofing on Create)**: `LedgerEntry` create where `ownerId != request.auth.uid` -> Rejected by `data.ownerId == request.auth.uid`.
3. **Payload 3 (Unverified Email Write)**: Authenticated user with `email_verified: false` attempting `create` -> Rejected by `isVerifiedUser()`.
4. **Payload 4 (Path ID Poisoning)**: 1,500-character junk string as `{entryId}` -> Rejected by `isValidId(entryId)`.
5. **Payload 5 (Invalid Hex Hash Format)**: `txHash: "not-a-hex-hash"` -> Rejected by `data.txHash.matches('^0x[a-fA-F0-9]+$')`.
6. **Payload 6 (Terminal State Mutation)**: Updating a `LedgerEntry` whose `existing().status == 'SETTLED'` -> Rejected by terminal state lock `existing().status != 'SETTLED'`.
7. **Payload 7 (Immutable Field Tampering)**: Updating `ownerId`, `txHash`, or `createdAt` on an existing `LedgerEntry` -> Rejected by `affectedKeys().hasOnly(...)` and immutability assertions.
8. **Payload 8 (Client Timestamp Forgery)**: Creating a `LedgerEntry` with a backdated `createdAt` != `request.time` -> Rejected by `incoming().createdAt == request.time`.
9. **Payload 9 (Denial-of-Wallet String Overflow)**: `threatVector` string of 50,000 characters -> Rejected by `data.threatVector.size() <= 160`.
10. **Payload 10 (Cross-Tenant List Scraping)**: Querying `/ledger_entries` without `where('ownerId', '==', request.auth.uid)` -> Rejected by `allow list: if isSignedIn() && existing().ownerId == request.auth.uid`.
11. **Payload 11 (Value Poisoning on Update)**: Updating `status` to `"HACKED_STATE"` -> Rejected because `isValidLedgerEntry(incoming())` wraps the entire `allow update` expression.
12. **Payload 12 (Self-Assigned Clearance Escalation)**: Updating `clearanceTier` on `/users/{userId}` after creation -> Rejected (no updates allowed to clearanceTier).

## 3. Red Team Conflict Report
- **Identity Spoofing**: PASS — `data.ownerId == request.auth.uid` enforced in `isValidLedgerEntry` and `isValidForensicReport`.
- **State Shortcutting / Terminal State**: PASS — `existing().status != 'SETTLED'` prevents modifying finalized settlements.
- **Resource Poisoning**: PASS — Every string and ID has explicit `.size()` bounds and regex pattern checks.
- **Update Validation Gate**: PASS — `isValidLedgerEntry(incoming())` wraps the entire `allow update` block.
