import { auth } from "~/server/auth/edge";

export default auth((req) => {
	const { nextUrl } = req;
	const isLoggedIn = !!req.auth;

	const isAuthPage = nextUrl.pathname.startsWith("/auth");
	const isApiRoute = nextUrl.pathname.startsWith("/api");
	const isDemoMode = req.cookies.get("activeAppContext")?.value === "demo";
	const isPublic = isAuthPage || isApiRoute || isDemoMode;

	if (!isLoggedIn && !isPublic) {
		return Response.redirect(new URL("/auth/signin", nextUrl));
	}

	if (isLoggedIn && isAuthPage) {
		return Response.redirect(new URL("/dashboard", nextUrl));
	}
});

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.webp$|.*\\.ico$).*)"],
};
