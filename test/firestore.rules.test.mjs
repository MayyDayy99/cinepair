/**
 * Firestore security-rules tests. Run with the emulator:
 *   npm run test:rules
 * (which is: firebase emulators:exec --only firestore "node --test test/firestore.rules.test.mjs")
 */
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, test } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, query, where,
  serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';

const PROJECT_ID = 'cinepair-rules-test';
const A = 'userA';
const B = 'userB';
const C = 'userC';
const MOVIE = '550';

let testEnv;

function userDoc(uid, extra = {}) {
  return { uid, displayName: 'Test', photoURL: 'x', email: 'a@b.c', partnerIds: [], createdAt: '2026-01-01', ...extra };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });

beforeEach(async () => { await testEnv.clearFirestore(); });

// Seed helper bypassing rules.
async function seed(fn) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });
}

// ---------------------------------------------------------------------------
// users: privilege escalation + validation
// ---------------------------------------------------------------------------
test('user can create their own valid profile', async () => {
  const db = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(db, 'users', A), userDoc(A)));
});

test('user CANNOT self-assign role:admin (privilege escalation blocked)', async () => {
  const db = testEnv.authenticatedContext(A).firestore();
  await assertFails(setDoc(doc(db, 'users', A), userDoc(A, { role: 'admin' })));
});

test('user cannot write another user\'s profile', async () => {
  const db = testEnv.authenticatedContext(A).firestore();
  await assertFails(setDoc(doc(db, 'users', B), userDoc(B)));
});

// ---------------------------------------------------------------------------
// users read: owner + linked only (PII protection)
// ---------------------------------------------------------------------------
test('user can read own profile; stranger cannot; linked partner can', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', A), userDoc(A));
    await setDoc(doc(db, 'users', B), userDoc(B, { partnerIds: [A] })); // B linked to A
    await setDoc(doc(db, 'users', C), userDoc(C));
  });
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(getDoc(doc(aDb, 'users', A)));          // own
  await assertFails(getDoc(doc(aDb, 'users', C)));             // stranger -> denied
  const bDb = testEnv.authenticatedContext(B).firestore();
  await assertSucceeds(getDoc(doc(bDb, 'users', A)));          // B has A in partnerIds -> allowed
});

// ---------------------------------------------------------------------------
// reciprocal pairing rule
// ---------------------------------------------------------------------------
test('a user may append ONLY their own uid to another user\'s partnerIds', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', A), userDoc(A));
    await setDoc(doc(db, 'users', B), userDoc(B));
  });
  const aDb = testEnv.authenticatedContext(A).firestore();
  // A adds itself to B.partnerIds -> allowed
  await assertSucceeds(updateDoc(doc(aDb, 'users', B), { partnerIds: arrayUnion(A) }));
  // A tries to add C to B.partnerIds -> denied
  await assertFails(updateDoc(doc(aDb, 'users', B), { partnerIds: arrayUnion(C) }));
});

test('a user cannot remove entries from another user\'s partnerIds', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', A), userDoc(A));
    await setDoc(doc(db, 'users', B), userDoc(B, { partnerIds: [A, C] }));
  });
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertFails(updateDoc(doc(aDb, 'users', B), { partnerIds: arrayRemove(C) }));
});

// ---------------------------------------------------------------------------
// swipes
// ---------------------------------------------------------------------------
test('owner can create a valid swipe; cannot write to another user\'s swipes', async () => {
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'users', A, 'swipes', MOVIE), {
    userId: A, movieId: MOVIE, type: 'like', timestamp: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(aDb, 'users', B, 'swipes', MOVIE), {
    userId: A, movieId: MOVIE, type: 'like', timestamp: serverTimestamp(),
  }));
});

test('partner swipes are readable only when linked (post partnerIds migration)', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', A), userDoc(A, { partnerIds: [B] })); // A linked to B
    await setDoc(doc(db, 'users', C), userDoc(C));                      // C not linked to B
    await setDoc(doc(db, 'users', B, 'swipes', MOVIE), { userId: B, movieId: MOVIE, type: 'like', timestamp: serverTimestamp() });
  });
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(getDocs(query(collection(aDb, 'users', B, 'swipes'), where('type', '==', 'like'))));
  const cDb = testEnv.authenticatedContext(C).firestore();
  await assertFails(getDocs(query(collection(cDb, 'users', B, 'swipes'), where('type', '==', 'like'))));
});

// ---------------------------------------------------------------------------
// matches: anti-forgery
// ---------------------------------------------------------------------------
async function seedBothLiked() {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', A, 'swipes', MOVIE), { userId: A, movieId: MOVIE, type: 'like', timestamp: serverTimestamp() });
    await setDoc(doc(db, 'users', B, 'swipes', MOVIE), { userId: B, movieId: MOVIE, type: 'like', timestamp: serverTimestamp() });
  });
}

test('match create succeeds when BOTH users liked and matchedBy == caller', async () => {
  await seedBothLiked();
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'matches', `${A}_${B}_${MOVIE}`), {
    movieId: MOVIE, userIds: [A, B], matchedBy: A, timestamp: serverTimestamp(),
  }));
});

test('match create FAILS when the other user has not liked (forgery blocked)', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', A, 'swipes', MOVIE), { userId: A, movieId: MOVIE, type: 'like', timestamp: serverTimestamp() });
    // B has NOT liked
  });
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertFails(setDoc(doc(aDb, 'matches', `${A}_${B}_${MOVIE}`), {
    movieId: MOVIE, userIds: [A, B], matchedBy: A, timestamp: serverTimestamp(),
  }));
});

test('match create FAILS when matchedBy is spoofed to the victim', async () => {
  await seedBothLiked();
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertFails(setDoc(doc(aDb, 'matches', `${A}_${B}_${MOVIE}`), {
    movieId: MOVIE, userIds: [A, B], matchedBy: B, timestamp: serverTimestamp(),
  }));
});

test('match update may flip watched but not membership/movie', async () => {
  await seedBothLiked();
  await seed(async (db) => {
    await setDoc(doc(db, 'matches', `${A}_${B}_${MOVIE}`), { movieId: MOVIE, userIds: [A, B], matchedBy: A, timestamp: serverTimestamp() });
  });
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'matches', `${A}_${B}_${MOVIE}`), { watched: true }, { merge: true }));
  await assertFails(updateDoc(doc(aDb, 'matches', `${A}_${B}_${MOVIE}`), { userIds: [A, C] }));
});

test('a non-member cannot read a match', async () => {
  await seedBothLiked();
  await seed(async (db) => {
    await setDoc(doc(db, 'matches', `${A}_${B}_${MOVIE}`), { movieId: MOVIE, userIds: [A, B], matchedBy: A, timestamp: serverTimestamp() });
  });
  const cDb = testEnv.authenticatedContext(C).firestore();
  await assertFails(getDoc(doc(cDb, 'matches', `${A}_${B}_${MOVIE}`)));
});

// ---------------------------------------------------------------------------
// invites: consent-based pairing
// ---------------------------------------------------------------------------
test('user can create a pending invite to another user, but not to self', async () => {
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'invites', `${A}_${B}`), {
    from: A, to: B, fromName: 'A', fromPhoto: '', status: 'pending', createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(aDb, 'invites', `${A}_${A}`), {
    from: A, to: A, status: 'pending', createdAt: serverTimestamp(),
  }));
});

test('invite create with a spoofed `from` is rejected', async () => {
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertFails(setDoc(doc(aDb, 'invites', `${B}_${C}`), {
    from: B, to: C, status: 'pending', createdAt: serverTimestamp(),
  }));
});

test('invite readable by sender and recipient only', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'invites', `${A}_${B}`), { from: A, to: B, status: 'pending', createdAt: serverTimestamp() });
  });
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(A).firestore(), 'invites', `${A}_${B}`)));
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(B).firestore(), 'invites', `${A}_${B}`)));
  await assertFails(getDoc(doc(testEnv.authenticatedContext(C).firestore(), 'invites', `${A}_${B}`)));
});

test('only recipient may change status; either party may delete', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'invites', `${A}_${B}`), { from: A, to: B, status: 'pending', createdAt: serverTimestamp() });
  });
  // sender A cannot accept their own invite
  await assertFails(updateDoc(doc(testEnv.authenticatedContext(A).firestore(), 'invites', `${A}_${B}`), { status: 'accepted' }));
  // recipient B accepts
  await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext(B).firestore(), 'invites', `${A}_${B}`), { status: 'accepted' }));
  // stranger C cannot delete
  await assertFails(deleteDoc(doc(testEnv.authenticatedContext(C).firestore(), 'invites', `${A}_${B}`)));
  // sender A can delete
  await assertSucceeds(deleteDoc(doc(testEnv.authenticatedContext(A).firestore(), 'invites', `${A}_${B}`)));
});

// ---------------------------------------------------------------------------
// collections (groups)
// ---------------------------------------------------------------------------
const COL = 'col1';
function colDoc(owner, members) {
  return { name: 'Szerelmem', ownerId: owner, memberIds: members, createdAt: serverTimestamp() };
}

test('owner can create a collection with self as owner+member; cannot spoof ownerId', async () => {
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'collections', COL), colDoc(A, [A])));
  await assertFails(setDoc(doc(aDb, 'collections', 'col2'), colDoc(B, [B])));
});

test('collection is readable by members only', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A, B])); });
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(A).firestore(), 'collections', COL)));
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(B).firestore(), 'collections', COL)));
  await assertFails(getDoc(doc(testEnv.authenticatedContext(C).firestore(), 'collections', COL)));
});

test('a non-member may join (add only self) but not add someone else', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A])); });
  await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext(B).firestore(), 'collections', COL), { memberIds: arrayUnion(B) }));
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A])); });
  await assertFails(updateDoc(doc(testEnv.authenticatedContext(C).firestore(), 'collections', COL), { memberIds: arrayUnion(B) }));
});

test('a member may leave (remove self) but not remove others; only owner renames', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A, B, C])); });
  await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext(B).firestore(), 'collections', COL), { memberIds: arrayRemove(B) }));
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A, B, C])); });
  await assertFails(updateDoc(doc(testEnv.authenticatedContext(B).firestore(), 'collections', COL), { memberIds: arrayRemove(C) }));
  await assertSucceeds(updateDoc(doc(testEnv.authenticatedContext(A).firestore(), 'collections', COL), { name: 'Haverok' }));
  await assertFails(updateDoc(doc(testEnv.authenticatedContext(B).firestore(), 'collections', COL), { name: 'Hekk' }));
});

test('only the owner can delete a collection', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A, B])); });
  await assertFails(deleteDoc(doc(testEnv.authenticatedContext(B).firestore(), 'collections', COL)));
  await assertSucceeds(deleteDoc(doc(testEnv.authenticatedContext(A).firestore(), 'collections', COL)));
});

test('collection watched flags are editable by members only', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'collections', COL), colDoc(A, [A, B])); });
  await assertSucceeds(setDoc(doc(testEnv.authenticatedContext(A).firestore(), 'collections', COL, 'watched', MOVIE), { at: serverTimestamp() }));
  await assertFails(setDoc(doc(testEnv.authenticatedContext(C).firestore(), 'collections', COL, 'watched', MOVIE), { at: serverTimestamp() }));
});

test('an invite may carry a collectionId', async () => {
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'invites', `${A}_${B}`), {
    from: A, to: B, status: 'pending', collectionId: COL, collectionName: 'Szerelmem', createdAt: serverTimestamp(),
  }));
});

// ---------------------------------------------------------------------------
// fcmTokens: owner-only
// ---------------------------------------------------------------------------
test('user manages own fcmTokens; cannot touch another user\'s', async () => {
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(setDoc(doc(aDb, 'users', A, 'fcmTokens', 'tok1'), { createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(aDb, 'users', B, 'fcmTokens', 'tok2'), { createdAt: serverTimestamp() }));
});

// ---------------------------------------------------------------------------
// movies: admin-gated writes
// ---------------------------------------------------------------------------
test('authenticated user can read movies but cannot write them', async () => {
  await seed(async (db) => { await setDoc(doc(db, 'movies', '1'), { title: 'x' }); });
  const aDb = testEnv.authenticatedContext(A).firestore();
  await assertSucceeds(getDoc(doc(aDb, 'movies', '1')));
  await assertFails(setDoc(doc(aDb, 'movies', '2'), { title: 'y' }));
});

test('unauthenticated access is denied', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'users', A)));
  await assertFails(getDoc(doc(db, 'movies', '1')));
});
