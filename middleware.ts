import { NextRequest, NextResponse } from "next/server";

export default async function middleware(request: NextRequest) {
  // Dynamic imports to reduce bundle size
  const [
    { auth },
    { headers },
    aj
  ] = await Promise.all([
    import("@/lib/auth"),
    import("next/headers"), 
    import("./lib/arcjet").then(m => m.default)
  ]);

  // Simple bot detection without heavy Arcjet rules
  const userAgent = request.headers.get("user-agent") || "";
  const isBot = /bot|crawler|spider/i.test(userAgent);
  
  if (!isBot) {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sign-in|assets).*)"],
};
