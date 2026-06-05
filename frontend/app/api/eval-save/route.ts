import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'

export async function POST(request: Request) {
  let content: string
  try {
    const body = await request.json()
    content = body.content
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'missing content' }, { status: 400 })
  }

  await writeFile('/tmp/eval_comparison_2026-06-04.md', content, 'utf8')
  return NextResponse.json({ ok: true, path: '/tmp/eval_comparison_2026-06-04.md' })
}
