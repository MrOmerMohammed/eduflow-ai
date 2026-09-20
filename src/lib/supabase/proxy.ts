import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { allowedRolesForPath, normalizeSchoolRole } from "@/lib/rbac";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
  if (!userId) return response;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/auth") || pathname === "/privacy" || pathname === "/terms" || pathname === "/security" || pathname === "/pricing") {
    return response;
  }

  const { data: memberships } = await supabase
    .from("school_memberships")
    .select("school_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!memberships?.length) return response;

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");
  const membership = memberships.find((item) => item.school_id === requestedSchoolId) ?? memberships[0];
  const role = normalizeSchoolRole(membership.role);
  const allowed = allowedRolesForPath(pathname);

  if (!role || !allowed.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = `?schoolId=${membership.school_id}`;
    return NextResponse.redirect(url);
  }

  return response;
}
