"use client";

import { useEffect, useState } from "react";
import { useDemoMode } from "~/context/demo-mode-context";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export function DemoFirstEntryModal() {
	const { isDemoMode, noticeDismissed, dismissDemoNotice, exitDemoMode } = useDemoMode();
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (isDemoMode && !noticeDismissed) {
			setOpen(true);
		} else {
			setOpen(false);
		}
	}, [isDemoMode, noticeDismissed]);

	const handleContinue = async () => {
		await dismissDemoNotice();
		setOpen(false);
	};

	const handleExit = async () => {
		setOpen(false);
		await exitDemoMode();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>You&apos;re in Demo Mode</DialogTitle>
					<DialogDescription className="space-y-2 pt-1 text-base">
						<span className="block">
							Explore the dashboard with realistic sample data. You can try adding
							investments, properties, and planning inputs.
						</span>
						<span className="block text-muted-foreground">
							Changes are temporary and won&apos;t be saved to your account.
						</span>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={() => void handleExit()}>
						Exit Demo Mode
					</Button>
					<Button onClick={() => void handleContinue()}>Continue</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
