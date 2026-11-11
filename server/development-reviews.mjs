import {randomUUID} from 'node:crypto';
import {AccessError} from './access.mjs';

const day = 24 * 60 * 60 * 1000;
const reviewInterval = 14 * day;
// Resend honours a request's idempotency key for 24 hours. Leave room for a slow invocation.
const retryWindow = 20 * 60 * 60 * 1000;
const batchSize = 4;

const developments = state => state.developments.filter(development => !development.sample);
const activeStaff = state => (state.users ?? []).filter(user => user.active && user.email);
const summary = ({id, name, area, postcode}) => ({id, name, area, postcode});

export function developmentReviewWorkspace(state, actor, emailConfigured) {
  const stock = developments(state);
  const consultants = state.users ?? [];
  const canAssign = actor.role === 'admin';
  const reviews = (state.developmentReviews ?? []).flatMap(review => {
    const development = stock.find(item => item.id === review.developmentId);
    if (!development || (!canAssign && review.assigneeId !== actor.id)) return [];
    const assignee = consultants.find(user => user.id === review.assigneeId);
    return [{...review, development: summary(development), assigneeName: assignee?.name ?? 'Former staff member', assigneeActive: Boolean(assignee?.active)}];
  });
  return {
    reviews,
    canAssign,
    emailConfigured,
    developments: canAssign ? stock.map(summary) : [],
    consultants: canAssign ? activeStaff(state).map(({id, name, email}) => ({id, name, email})) : [],
  };
}

export function assignDevelopmentReview(state, body, now = Date.now()) {
  if (!developments(state).some(development => development.id === body?.developmentId)) throw new AccessError('Published development not found.', 404);
  if (body.assigneeId !== null && !activeStaff(state).some(user => user.id === body.assigneeId)) throw new AccessError('Choose an active consultant.');
  const reviews = state.developmentReviews ??= [];
  const index = reviews.findIndex(review => review.developmentId === body.developmentId);
  const current = reviews[index];
  if ((current?.version ?? null) !== body.version) throw new AccessError('The assignment changed. Refresh the list and try again.', 409);
  if (body.assigneeId === null) {
    if (current) reviews.splice(index, 1);
  } else if (current?.assigneeId !== body.assigneeId) {
    const next = {developmentId: body.developmentId, assigneeId: body.assigneeId, version: randomUUID(), nextReminderAt: now + reviewInterval};
    if (current) reviews[index] = next;
    else reviews.push(next);
  }
  return {ok: true};
}

export function confirmDevelopmentReview(state, actor, body, now = Date.now()) {
  const review = (state.developmentReviews ?? []).find(item => item.developmentId === body?.developmentId);
  if (!review || !developments(state).some(development => development.id === review.developmentId)) throw new AccessError('Development review not found.', 404);
  if (review.assigneeId !== actor.id) throw new AccessError('Only the assigned consultant can confirm this review.', 403);
  if (review.version !== body.version) throw new AccessError('The review changed. Refresh the list and try again.', 409);
  Object.assign(review, {version: randomUUID(), lastConfirmedAt: now, nextReminderAt: now + reviewInterval});
  delete review.lastFailureAt;
  return {ok: true};
}

function sameCycle(review, job, cycle) {
  return review.developmentId === cycle.developmentId && review.assigneeId === job.assigneeId &&
    review.version === cycle.version && review.nextReminderAt === cycle.nextReminderAt;
}

function currentJob(state, job) {
  return activeStaff(state).some(user => user.id === job.assigneeId && user.email === job.to) &&
    job.cycles.every(cycle => developments(state).some(d => d.id === cycle.developmentId) &&
      (state.developmentReviews ?? []).some(review => sameCycle(review, job, cycle)));
}

function finishJob(state, job, time, delivered) {
  for (const cycle of job.cycles) {
    const review = (state.developmentReviews ?? []).find(item => sameCycle(item, job, cycle));
    if (!review) continue;
    review.nextReminderAt = time + reviewInterval;
    if (delivered) {
      review.lastReminderAt = time;
      delete review.lastFailureAt;
    } else review.lastFailureAt = time;
  }
  state.developmentReviewMail = (state.developmentReviewMail ?? []).filter(item => item.id !== job.id);
}

function dueDigests(state, time) {
  const stock = new Map(developments(state).map(development => [development.id, development]));
  const staff = new Map(activeStaff(state).map(user => [user.id, user]));
  const digests = new Map();
  for (const review of state.developmentReviews ?? []) {
    const consultant = staff.get(review.assigneeId), development = stock.get(review.developmentId);
    if (!consultant || !development || review.nextReminderAt > time) continue;
    if (!digests.has(consultant.id)) digests.set(consultant.id, {consultant, items: []});
    digests.get(consultant.id).items.push({review, development});
  }
  return digests;
}

function queueDigests(state, time, from, workspaceUrl) {
  state.developmentReviewMail ??= [];
  for (const job of state.developmentReviewMail) {
    if (time - job.queuedAt >= retryWindow || !currentJob(state, job)) finishJob(state, job, time, false);
  }
  const queued = new Set(state.developmentReviewMail.map(job => job.assigneeId));
  for (const {consultant, items} of dueDigests(state, time).values()) {
    if (state.developmentReviewMail.length >= batchSize) break;
    if (queued.has(consultant.id)) continue;
    const names = items.map(({development}) => `• ${development.name} (${development.area}, ${development.postcode})`).join('\n');
    state.developmentReviewMail.push({
      id: randomUUID(), assigneeId: consultant.id, queuedAt: time, from, to: consultant.email,
      subject: 'JLL portfolio development details due for review',
      text: `Hi ${consultant.name},\n\nPlease check the description, pricing and availability for these developments. Update any details that need changing, then confirm each review in the staff workspace.\n\n${names}\n\nOpen Development reviews: ${workspaceUrl}\n`,
      cycles: items.map(({review: {developmentId, version, nextReminderAt}}) => ({developmentId, version, nextReminderAt})),
    });
  }
  return state.developmentReviewMail.slice(0, batchSize);
}

export async function sendDevelopmentReviewReminders(repository, {send, from, siteUrl, now = Date.now}) {
  const time = now(), state = await repository.read();
  if (!state.developmentReviewMail?.length && !dueDigests(state, time).size) return {sent: 0, pending: 0};
  const workspaceUrl = new URL('/?staff=reviews#admin', siteUrl).href;
  const jobs = await repository.update(next => queueDigests(next, time, from, workspaceUrl));
  let sent = 0, pending = 0;
  for (const job of jobs) {
    const current = await repository.read();
    if (!current.developmentReviewMail?.some(item => item.id === job.id) || !currentJob(current, job)) continue;
    try {
      await send(job);
    } catch {
      pending++;
      continue;
    }
    await repository.update(next => finishJob(next, job, now(), true));
    sent++;
  }
  return {sent, pending};
}

export function developmentReviewEmailSettings() {
  const get = name => globalThis.Netlify?.env?.get(name) ?? process.env[name];
  return {apiKey: get('DEVELOPMENT_REVIEW_RESEND_API_KEY'), from: get('DEVELOPMENT_REVIEW_FROM')};
}

export function resendDevelopmentReview(apiKey, fetchEmail = fetch) {
  return async ({id, from, to, subject, text}) => {
    const response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST',
      headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `development-review/${id}`},
      body: JSON.stringify({from, to: [to], subject, text}),
      signal: AbortSignal.timeout(4500),
    });
    if (!response.ok) throw Error(`Email provider returned ${response.status}`);
  };
}
