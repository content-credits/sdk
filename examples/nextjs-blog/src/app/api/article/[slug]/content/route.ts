import { NextRequest, NextResponse } from 'next/server';
import { getArticleBySlug } from '@/lib/articles';

const CC_API_BASE = process.env.CC_API_BASE_URL ?? 'https://api.contentcredits.com';

/**
 * GET /api/article/[slug]/content
 *
 * Returns the full article content ONLY after verifying with the Content
 * Credits API that the requesting user has purchased this article.
 *
 * The client passes its CC access token in the Authorization header.
 * This server-side route forwards the check to the CC API so the full
 * article content is never included in the initial page HTML or RSC
 * payload — inspect-element attacks return only the teaser.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const article = getArticleBySlug(params.slug);
  if (!article || !article.isPremium) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const apiKey = process.env.NEXT_PUBLIC_CC_API_KEY ?? '';
  const origin = req.nextUrl.origin;

  let ccRes: Response;
  try {
    ccRes = await fetch(`${CC_API_BASE}/credits/check-article-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        apiKey,
        postUrl: `${origin}/blog/${params.slug}`,
        postName: article.title,
        hostName: req.nextUrl.hostname,
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }

  if (!ccRes.ok) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const data = await ccRes.json();
  if (!data.success) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({ content: article.content });
}
