import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
// Import only what you need from Arcjet
import aj from "./lib/arcjet";

export default async function middleware(request: NextRequest) {
  try {
    // Handle Arcjet protection first
    const decision = await aj
      .withRule({
        type: "shield",
        mode: "LIVE",
      })
      .withRule({
        type: "detectBot", 
        mode: "LIVE",
        allow: ["CATEGORY:SEARCH_ENGINE", "G00G1E_CRAWLER"],
      })
      .protect(request);

    if (decision.isDenied()) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Handle auth
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sign-in|assets).*)"],
};
