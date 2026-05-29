import { NextResponse } from 'next/server'
import {
  adminCredentialsConfigured,
  isAdminRequestAuthenticated,
} from '@/lib/admin-auth-server'

export async function GET(req: Request) {
  const authenticated = await isAdminRequestAuthenticated(req)
  return NextResponse.json({
    authenticated,
    configured: adminCredentialsConfigured(),
  })
}
