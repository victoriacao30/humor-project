import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();
    const path = request.nextUrl.pathname;

    const redirectTo = (to: string) => {
        const url = request.nextUrl.clone();
        url.pathname = to;
        url.search = "";
        const redirect = NextResponse.redirect(url);
        response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
        return redirect;
    };

    const isProtected = ["/members", "/profile", "/onboarding", "/enter", "/vote"].some((p) =>
        path.startsWith(p)
    );

    if (!user) {
        return isProtected ? redirectTo("/") : response;
    }

    const skipNameCheck =
        path.startsWith("/onboarding") ||
        path.startsWith("/auth") ||
        path.startsWith("/privacy");

    if (!skipNameCheck) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
        if (!profile?.first_name || !profile?.last_name) {
            return redirectTo("/onboarding");
        }
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
