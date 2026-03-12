import { auth } from "~/server/auth/edge";

export default auth((req) => {
	const { nextUrl } = req;
	const isLoggedIn = !!req.auth;

	const isAuthPage = nextUrl.pathname.startsWith("/auth");
	const isApiRoute = nextUrl.pathname.startsWith("/api");
	const isPublic = isAuthPage || isApiRoute;

	if (!isLoggedIn && !isPublic) {
		return Response.redirect(new URL("/auth/signin", nextUrl));
	}

	if (isLoggedIn && isAuthPage) {
		return Response.redirect(new URL("/dashboard", nextUrl));
	}
});

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
