import test from 'node:test';
import assert from 'node:assert/strict';
import {resendDevelopmentReview, sendDevelopmentReviewReminders} from './development-reviews.mjs';

const day = 86400000;
const dueAt = Date.UTC(2026, 10, 11, 9);
function environment() {
  const developments = ['a', 'b', 'c'].map(id => ({id, name: `Development ${id}`, area: 'East London', postcode: 'E1'}));
  const consultant = {id: 'consultant', name: 'Consultant', active: true, email: 'consultant@example.test'};
  let state = {
    developments,
    users: [consultant, {...consultant, id: 'inactive', active: false}],
    developmentReviews: developments.map(({id}) => ({developmentId: id, assigneeId: id === 'c' ? 'inactive' : consultant.id, version: id, nextReminderAt: dueAt})),
  };
  return {
    read: async () => structuredClone(state),
    update: async change => {
      const next = structuredClone(state);
      const result = change(next);
      state = next;
      return structuredClone(result);
    },
  };
}

test('due developments are emailed together and retries reuse the same delivery', async () => {
  const repository = environment();
  const requests = [];
  let time = dueAt - 1;
  const send = resendDevelopmentReview('test-key', async (url, options) => {
    requests.push({url, key: options.headers['Idempotency-Key'], body: JSON.parse(options.body)});
    return new Response(null, {status: requests.length === 1 ? 503 : 200});
  });
  const run = () => sendDevelopmentReviewReminders(repository, {send, from: 'portfolio@example.test', siteUrl: 'https://portfolio.example', now: () => time});
  assert.deepEqual(await run(), {sent: 0, pending: 0});
  time++;
  assert.deepEqual(await run(), {sent: 0, pending: 1});
  assert.equal((await repository.read()).developmentReviews[0].nextReminderAt, dueAt);
  time += 3600000;
  assert.deepEqual(await run(), {sent: 1, pending: 0});
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[1].body.to, ['consultant@example.test']);
  assert.match(requests[1].body.text, /Development a.*\n.*Development b/);
  assert.doesNotMatch(requests[1].body.text, /Development c/);
  assert.match(requests[1].body.text, /https:\/\/portfolio\.example\/\?staff=reviews#admin/);
  const state = await repository.read();
  assert.equal(state.developmentReviews[0].lastReminderAt, time);
  assert.equal(state.developmentReviews[0].nextReminderAt, time + 14 * day);
  assert.equal(state.developmentReviewMail.length, 0);
  assert.deepEqual(await run(), {sent: 0, pending: 0});
  assert.equal(requests.length, 2);
});

test('a queued reminder stops when its consultant becomes inactive', async () => {
  const repository = environment();
  let attempts = 0;
  const run = () => sendDevelopmentReviewReminders(repository, {
    send: async () => {attempts++;throw Error('Temporary mail error');},
    from: 'portfolio@example.test', siteUrl: 'https://portfolio.example', now: () => dueAt,
  });
  await run();
  await repository.update(state => {state.users[0].active = false;});
  await run();
  assert.equal(attempts, 1);
  assert.equal((await repository.read()).developmentReviewMail.length, 0);
});
