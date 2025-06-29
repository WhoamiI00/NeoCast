import { NextRequest, NextResponse } from "next/server";
import aj from "./lib/arcjet";

export default async function middleware(request: NextRequest) {
  // Quick Arcjet check first (lighter weight)
  const decision = await aj.protect(request);
  
  if (decision.isDenied()) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Lazy load auth only when needed
  const { auth } = await import("@/lib/auth");
  const { headers } = await import("next/headers");
  
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sign-in|assets).*)"],
};
