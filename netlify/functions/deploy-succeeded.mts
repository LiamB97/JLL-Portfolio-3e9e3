import type { Context } from '@netlify/functions'
import { applyStockSnapshot, portfolioRepository } from '../../server/netlify-store.mjs'
import { applyRegionalReviewPlan, regionalReviewPlanCoverage } from '../../server/regional-review-plan.mjs'

// Netlify verifies the platform event before invoking this reserved function.
export default async function handler(_request: Request, { deploy }: Context) {
  if (deploy.context !== 'production' || !deploy.published) return new Response(null, { status: 200 })

  const repository = portfolioRepository()
  const result = await applyStockSnapshot(repository)
  if (result) console.log(`Applied a verified website snapshot of ${result.imported} JLL developments.`)

  const plan = process.env.JLL_REGIONAL_REVIEW_PLAN
  if (!plan) return new Response(null, { status: 200 })

  await applyRegionalReviewPlan(repository, plan)
  const coverage = regionalReviewPlanCoverage(await repository.read(), plan)
  if (coverage.some(region => region.grouped !== region.expected ||
      region.consultants.some(consultant => consultant.count + consultant.queued !== region.expected))) {
    console.error('Regional review assignment coverage is incomplete:', JSON.stringify(coverage))
    return new Response(null, { status: 422 })
  }
  console.log('Verified regional review assignment coverage:', JSON.stringify(coverage))
  return new Response(null, { status: 204 })
}
