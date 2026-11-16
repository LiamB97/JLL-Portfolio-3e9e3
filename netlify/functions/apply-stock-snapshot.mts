import type { NetlifyFunction } from '@netlify/functions'
import { applyStockSnapshot, portfolioRepository } from '../../server/netlify-store.mjs'

export default {
  async deploySucceeded({ deploy }) {
    if (deploy.context !== 'production' || !deploy.publishedAt) return

    const result = await applyStockSnapshot(portfolioRepository())
    if (result) console.log(`Applied a verified website snapshot of ${result.imported} JLL developments.`)
  },
} satisfies NetlifyFunction
