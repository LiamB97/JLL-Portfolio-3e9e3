import { createHash, timingSafeEqual } from 'node:crypto'
import type { Context } from '@netlify/functions'
import { portfolioRepository } from '../../server/netlify-store.mjs'
import { regionalReviewPlanCoverage } from '../../server/regional-review-plan.mjs'

// Temporary, read-only support for the private production rollout.
export default async function handler(request: Request, { deploy }: Context) {
  const unavailable = () => new Response(null, { status: 404 })
  if (request.method !== 'GET' || deploy.context !== 'production' || !deploy.published) return unavailable()
  const raw = process.env.JLL_REGIONAL_REVIEW_PLAN
  const { verification } = JSON.parse(raw || '{}')
  if (!verification || !Number.isSafeInteger(verification.expiresAt) ||
      verification.expiresAt <= Date.now() || !/^[0-9a-f]{64}$/.test(verification.digest)) return unavailable()

  const token = request.headers.get('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1]
  if (!token || !timingSafeEqual(createHash('sha256').update(token).digest(), Buffer.from(verification.digest, 'hex'))) return unavailable()

  const state = await portfolioRepository().read()
  const coverage = regionalReviewPlanCoverage(state, raw)
  const accounts = coverage.flatMap(group => group.consultants).map(({ name }) => {
    const first = name.toLowerCase()
    const matches = (person: { name?: string; email?: string }) =>
      person.name?.trim().toLowerCase().split(/\s+/)[0] === first ||
      person.email?.toLowerCase().split(/[^a-z0-9]/)[0] === first
    return {
      name,
      roles: (state.users ?? []).filter(matches).map(({ role, active }) => ({ role, active })),
      hasPendingInvitation: (state.invites ?? []).some(invite => matches(invite) && invite.expiresAt > Date.now()),
    }
  })
  return Response.json({ coverage, accounts }, { headers: { 'Cache-Control': 'no-store' } })
}
