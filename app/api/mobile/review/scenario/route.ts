import { NextResponse } from "next/server";
import { getApiAuthUser } from "../../../../../lib/auth";
import { isReviewDeployment, prepareReviewScenario } from "../../../../../lib/review";
import { LifecycleError } from "../../../../../lib/lifecycle";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isReviewDeployment(request)) return new Response("Not found", { status: 404 });
  const user = await getApiAuthUser(request);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    await prepareReviewScenario(user.id, body?.scenario);
    return NextResponse.json({ ready: true });
  } catch (error) {
    if (error instanceof LifecycleError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "REVIEW_UNAVAILABLE" }, { status: 503 });
  }
}
