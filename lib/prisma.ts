import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return undefined
  return url.replace(/^["']|["']$/g, '')
}

if (!getDatabaseUrl()) {
  console.error(
    '[prisma] DATABASE_URL is missing. Add it to .env.local and restart with: npm run dev'
  )
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: getDatabaseUrl() ? { db: { url: getDatabaseUrl() } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
