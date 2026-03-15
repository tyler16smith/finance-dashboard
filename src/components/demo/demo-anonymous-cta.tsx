"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useDemoMode } from "~/context/demo-mode-context";
import { Button } from "~/components/ui/button";

export function DemoAnonymousCta() {
	const { isDemoMode } = useDemoMode();
	const { data: session } = useSession();

	if (!isDemoMode || session?.user) return null;

	return (
		<div className="flex items-center justify-between gap-4 border-b bg-muted/60 px-4 py-2 text-sm">
			<span className="text-muted-foreground">
				Like what you see? Create a free account to track your own finances.
			</span>
			<div className="flex shrink-0 items-center gap-2">
				<Button asChild size="sm" variant="outline">
					<Link href="/auth/signin">Sign in</Link>
				</Button>
				<Button asChild size="sm">
					<Link href="/auth/register">Create account</Link>
				</Button>
			</div>
		</div>
	);
}
