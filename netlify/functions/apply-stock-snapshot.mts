import type { NetlifyFunction } from '@netlify/functions'
import { applyStockSnapshot, portfolioRepository } from '../../server/netlify-store.mjs'
import { applyRegionalReviewPlan } from '../../server/regional-review-plan.mjs'

export default {
  async deploySucceeded({ deploy }) {
    if (deploy.context !== 'production' || !deploy.publishedAt) return

    const repository = portfolioRepository()
    const result = await applyStockSnapshot(repository)
    if (result) console.log(`Applied a verified website snapshot of ${result.imported} JLL developments.`)

    const plan = process.env.JLL_REGIONAL_REVIEW_PLAN
    if (plan) {
      const assignments = await applyRegionalReviewPlan(repository, plan)
      if (assignments) console.log('Applied regional review plan:', JSON.stringify(assignments))
    }
  },
} satisfies NetlifyFunction
