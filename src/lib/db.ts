import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

    return new PrismaClient({ adapter: new PrismaPg(pool) })
}

// 4. Correctly type globalThis to avoid TypeScript errors
const globalForPrisma = globalThis as unknown as {
    prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
}

const prisma = globalForPrisma.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaGlobal = prisma
