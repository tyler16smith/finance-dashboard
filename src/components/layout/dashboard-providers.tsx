"use client";

import { DemoModeProvider } from "~/context/demo-mode-context";
import { ForecastProvider } from "~/context/forecast-context";

export function DashboardProviders({ children }: { children: React.ReactNode }) {
	return (
		<DemoModeProvider>
			<ForecastProvider>{children}</ForecastProvider>
		</DemoModeProvider>
	);
}
