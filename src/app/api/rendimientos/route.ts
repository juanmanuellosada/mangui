import { NextResponse } from "next/server"
import { getRendimientos } from "@/lib/rendimientos/argentinadatos"

export const revalidate = 21600

export async function GET() {
  const data = await getRendimientos()
  return NextResponse.json(data)
}
