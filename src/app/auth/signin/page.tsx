"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

export default function SignInPage() {
	return (
		<Suspense>
			<SignInForm />
		</Suspense>
	);
}

function SignInForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleCredentialsSignIn(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});

		setLoading(false);

		if (result?.error) {
			setError("Invalid email or password.");
		} else {
			router.push(callbackUrl);
		}
	}

	async function handleGoogleSignIn() {
		await signIn("google", { callbackUrl });
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">Welcome back</CardTitle>
					<CardDescription>Sign in to your finance dashboard</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Button
						className="w-full"
						onClick={handleGoogleSignIn}
						type="button"
						variant="outline"
					>
						<svg
							aria-hidden="true"
							className="mr-2 h-4 w-4"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								fill="#4285F4"
							/>
							<path
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								fill="#34A853"
							/>
							<path
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								fill="#FBBC05"
							/>
							<path
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								fill="#EA4335"
							/>
						</svg>
						Continue with Google
					</Button>

					<div className="flex items-center gap-3">
						<Separator className="flex-1" />
						<span className="text-muted-foreground text-xs">or</span>
						<Separator className="flex-1" />
					</div>

					<form className="space-y-4" onSubmit={handleCredentialsSignIn}>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								autoComplete="email"
								id="email"
								onChange={(e) => setEmail(e.target.value)}
								placeholder="you@example.com"
								required
								type="email"
								value={email}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								autoComplete="current-password"
								id="password"
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								required
								type="password"
								value={password}
							/>
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<Button className="w-full" disabled={loading} type="submit">
							{loading ? "Signing in…" : "Sign in"}
						</Button>
					</form>

					<p className="text-center text-muted-foreground text-sm">
						Don&apos;t have an account?{" "}
						<Link
							className="text-primary underline underline-offset-4"
							href="/auth/register"
						>
							Create one
						</Link>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
