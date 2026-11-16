import {randomUUID} from 'node:crypto';

export const reviewInterval = 14 * 24 * 60 * 60 * 1000;

export function newDevelopmentReview(developmentId, assigneeId, now) {
  return {developmentId, assigneeId, version: randomUUID(), nextReminderAt: now + reviewInterval};
}
