"use client";

import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	buildDefaultClassifications,
	type CategoryClassification,
	INTERNAL_FIELDS,
	suggestMapping,
} from "~/lib/category-normalize";

type Step = "upload" | "mapping" | "categorize" | "importing" | "done";

type CategoryEntry = { classification: CategoryClassification; count: number };

interface OnboardingFlowProps {
	hasExistingData?: boolean;
}

export function OnboardingFlow({
	hasExistingData = false,
}: OnboardingFlowProps) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<Step>("upload");
	const [isDragging, setIsDragging] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [headers, setHeaders] = useState<string[]>([]);
	const [preview, setPreview] = useState<Record<string, string>[]>([]);
	const [mapping, setMapping] = useState<Record<string, string>>({});
	const [categoryMap, setCategoryMap] = useState<Record<string, CategoryEntry>>(
		{},
	);
	const [importMode, setImportMode] = useState<"replace" | "append">("replace");
	const [importResult, setImportResult] = useState<{
		imported: number;
		skipped: number;
	} | null>(null);
	const [progress, setProgress] = useState(0);

	const parseHeadersFromFile = useCallback((f: File) => {
		Papa.parse<Record<string, string>>(f, {
			header: true,
			preview: 3,
			skipEmptyLines: true,
			complete: (results) => {
				const hdrs = results.meta.fields ?? [];
				setHeaders(hdrs);
				setPreview(results.data);
				setMapping(suggestMapping(hdrs));
				setStep("mapping");
			},
			error: () => toast.error("Failed to parse CSV file."),
		});
	}, []);

	const handleFileSelected = useCallback(
		(f: File) => {
			if (!f.name.endsWith(".csv") && f.type !== "text/csv") {
				toast.error("Please upload a CSV file.");
				return;
			}
			setFile(f);
			parseHeadersFromFile(f);
		},
		[parseHeadersFromFile],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const dropped = e.dataTransfer.files[0];
			if (dropped) handleFileSelected(dropped);
		},
		[handleFileSelected],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback(() => setIsDragging(false), []);

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (f) handleFileSelected(f);
	}

	const requiredMapped = INTERNAL_FIELDS.filter((f) => f.required).every(
		(f) => mapping[f.key],
	);

	function handleContinueFromMapping() {
		const hasCategoryCol = !!mapping.category;
		const hasTypeCol = !!mapping.type;

		if (!hasCategoryCol && !hasTypeCol) {
			toast.warning(
				"No category or type column mapped — transactions will be classified by amount sign only.",
			);
			void handleImport({});
			return;
		}

		if (!file) return;

		Papa.parse<Record<string, string>>(file, {
			header: true,
			skipEmptyLines: true,
			complete: (results) => {
				const valueCounts: Record<string, number> = {};
				for (const row of results.data) {
					const catVal = mapping.category
						? (row[mapping.category] ?? "").trim()
						: "";
					const typeVal = mapping.type ? (row[mapping.type] ?? "").trim() : "";
					if (catVal) valueCounts[catVal] = (valueCounts[catVal] ?? 0) + 1;
					if (typeVal && typeVal !== catVal)
						valueCounts[typeVal] = (valueCounts[typeVal] ?? 0) + 1;
				}
				const entries = Object.entries(valueCounts).map(([value, count]) => ({
					value,
					count,
				}));
				setCategoryMap(buildDefaultClassifications(entries));
				setStep("categorize");
			},
			error: () => toast.error("Failed to parse CSV."),
		});
	}

	async function handleImport(
		catClassifications: Record<string, "INCOME" | "EXPENSE" | "SKIP">,
	) {
		if (!file) return;
		setStep("importing");
		setProgress(10);

		const formData = new FormData();
		formData.append("file", file);
		formData.append("mapping", JSON.stringify(mapping));
		formData.append(
			"categoryClassifications",
			JSON.stringify(catClassifications),
		);
		formData.append("mode", importMode);

		try {
			setProgress(40);
			const res = await fetch("/api/import", {
				method: "POST",
				body: formData,
			});
			setProgress(80);

			if (!res.ok) {
				const err = (await res.json()) as { error: string };
				throw new Error(err.error);
			}

			const result = (await res.json()) as {
				imported: number;
				skipped: number;
			};
			setImportResult(result);
			setProgress(100);
			setStep("done");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Import failed.");
			setStep("mapping");
			setProgress(0);
		}
	}

	function handleImportFromCategorize() {
		const classifications: Record<string, "INCOME" | "EXPENSE" | "SKIP"> = {};
		for (const [key, entry] of Object.entries(categoryMap)) {
			classifications[key] = entry.classification;
		}
		void handleImport(classifications);
	}

	const classificationLabels: Record<CategoryClassification, string> = {
		INCOME: "✅ Income",
		EXPENSE: "💸 Expense",
		SKIP: "🚫 Skip",
	};

	// ─── Upload step ───────────────────────────────────────────────────────────
	if (step === "upload") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="w-full max-w-lg">
					<CardHeader className="text-center">
						<CardTitle className="text-2xl">Finance with Fin</CardTitle>
						<CardDescription>
							Upload a CSV file from your bank or financial institution to get
							started.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<button
							className={`flex w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
								isDragging
									? "border-primary bg-primary/5"
									: "border-muted-foreground/25 hover:border-primary/50"
							}`}
							onClick={() => inputRef.current?.click()}
							onDragLeave={handleDragLeave}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
							type="button"
						>
							<div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
								<svg
									aria-hidden="true"
									className="h-7 w-7 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									strokeWidth={1.5}
									viewBox="0 0 24 24"
								>
									<path
										d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							</div>
							<div className="text-center">
								<p className="font-medium text-sm">
									Drop your CSV here, or{" "}
									<span className="text-primary">browse</span>
								</p>
								<p className="mt-1 text-muted-foreground text-xs">
									Supports exports from Chase, Bank of America, Mint, YNAB, and
									most banks
								</p>
							</div>
						</button>
						<input
							accept=".csv,text/csv"
							className="hidden"
							onChange={handleInputChange}
							ref={inputRef}
							type="file"
						/>
						{hasExistingData && (
							<div className="space-y-3 rounded-lg border p-4">
								<p className="font-medium text-sm">Import mode</p>
								<div className="space-y-2">
									<label className="flex cursor-pointer items-start gap-3">
										<input
											checked={importMode === "replace"}
											className="mt-0.5"
											name="importMode"
											onChange={() => setImportMode("replace")}
											type="radio"
										/>
										<div>
											<p className="font-medium text-sm">
												Replace existing data
											</p>
											<p className="text-muted-foreground text-xs">
												Deletes all current income/expense transactions and
												imports this file fresh.
											</p>
										</div>
									</label>
									<label className="flex cursor-pointer items-start gap-3">
										<input
											checked={importMode === "append"}
											className="mt-0.5"
											name="importMode"
											onChange={() => setImportMode("append")}
											type="radio"
										/>
										<div>
											<p className="font-medium text-sm">
												Add to existing data
											</p>
											<p className="text-muted-foreground text-xs">
												Appends without removing anything. Use this if your CSV
												covers a new date range only.
											</p>
										</div>
									</label>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	// ─── Mapping step ──────────────────────────────────────────────────────────
	if (step === "mapping") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="w-full max-w-2xl">
					<CardHeader>
						<CardTitle>Map your columns</CardTitle>
						<CardDescription>
							Tell us which columns in <strong>{file?.name}</strong> correspond
							to each field. Required fields are marked.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-3">
							{INTERNAL_FIELDS.map((field) => (
								<div
									className="flex items-center justify-between gap-4"
									key={field.key}
								>
									<div className="flex min-w-[140px] items-center gap-2">
										<span className="font-medium text-sm">{field.label}</span>
										{field.required && (
											<Badge className="text-xs" variant="destructive">
												required
											</Badge>
										)}
									</div>
									<Select
										onValueChange={(v) =>
											setMapping((prev) => ({
												...prev,
												[field.key]: v === "__none__" ? "" : v,
											}))
										}
										value={mapping[field.key] ?? "__none__"}
									>
										<SelectTrigger className="flex-1">
											<SelectValue placeholder="— not mapped —" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="__none__">— not mapped —</SelectItem>
											{headers.map((h) => (
												<SelectItem key={h} value={h}>
													{h}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							))}
						</div>

						{/* Preview */}
						{preview.length > 0 && (
							<div>
								<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
									Preview (first 3 rows)
								</p>
								<div className="overflow-x-auto rounded-lg border text-xs">
									<table className="w-full">
										<thead>
											<tr className="border-b bg-muted/50">
												{headers.slice(0, 6).map((h) => (
													<th
														className="px-3 py-2 text-left font-medium"
														key={h}
													>
														{h}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{preview.map((row, i) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: CSV preview rows have no stable key
												<tr className="border-b last:border-0" key={i}>
													{headers.slice(0, 6).map((h) => (
														<td
															className="px-3 py-2 text-muted-foreground"
															key={h}
														>
															{row[h] ?? ""}
														</td>
													))}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}

						<div className="flex gap-3">
							<Button
								onClick={() => setStep("upload")}
								type="button"
								variant="outline"
							>
								Back
							</Button>
							<Button
								className="flex-1"
								disabled={!requiredMapped}
								onClick={handleContinueFromMapping}
								type="button"
							>
								Continue
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// ─── Categorize step ───────────────────────────────────────────────────────
	if (step === "categorize") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="w-full max-w-2xl">
					<CardHeader>
						<CardTitle>Classify categories</CardTitle>
						<CardDescription>
							Tell us what each category value means. Rows marked{" "}
							<strong>Skip</strong> will not be imported.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="overflow-hidden rounded-lg border">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b bg-muted/50">
										<th className="px-4 py-2 text-left font-medium">
											Raw value from CSV
										</th>
										<th className="px-4 py-2 text-left font-medium">Rows</th>
										<th className="px-4 py-2 text-left font-medium">
											Classify as
										</th>
									</tr>
								</thead>
								<tbody>
									{Object.entries(categoryMap).map(([value, entry]) => (
										<tr className="border-b last:border-0" key={value}>
											<td className="px-4 py-2 font-mono text-xs">{value}</td>
											<td className="px-4 py-2 text-muted-foreground">
												<Badge variant="secondary">{entry.count}</Badge>
											</td>
											<td className="px-4 py-2">
												<Select
													onValueChange={(v) =>
														setCategoryMap((prev) => {
															const existing = prev[value];
															if (!existing) return prev;
															return {
																...prev,
																[value]: {
																	...existing,
																	classification: v as CategoryClassification,
																},
															};
														})
													}
													value={entry.classification}
												>
													<SelectTrigger className="w-40">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{(
															[
																"INCOME",
																"EXPENSE",
																"SKIP",
															] as CategoryClassification[]
														).map((c) => (
															<SelectItem key={c} value={c}>
																{classificationLabels[c]}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<div className="flex gap-3">
							<Button
								onClick={() => setStep("mapping")}
								type="button"
								variant="outline"
							>
								Back
							</Button>
							<Button
								className="flex-1"
								onClick={handleImportFromCategorize}
								type="button"
							>
								Import transactions
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// ─── Importing step ────────────────────────────────────────────────────────
	if (step === "importing") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-4">
				<Card className="w-full max-w-md text-center">
					<CardContent className="pt-10 pb-8">
						<p className="mb-4 font-medium text-lg">Importing your data…</p>
						<Progress className="h-2" value={progress} />
						<p className="mt-3 text-muted-foreground text-sm">
							Validating and categorizing transactions
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	// ─── Done step ─────────────────────────────────────────────────────────────
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-4">
			<Card className="w-full max-w-md text-center">
				<CardContent className="space-y-6 pt-10 pb-8">
					<div className="flex justify-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
							<svg
								aria-hidden="true"
								className="h-8 w-8 text-green-600"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								viewBox="0 0 24 24"
							>
								<path
									d="M4.5 12.75l6 6 9-13.5"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</div>
					</div>
					<div>
						<p className="font-semibold text-xl">Import complete!</p>
						<p className="mt-1 text-muted-foreground text-sm">
							{importResult?.imported.toLocaleString()} transactions imported
							{(importResult?.skipped ?? 0) > 0 &&
								`, ${importResult?.skipped} rows skipped`}
						</p>
					</div>
					<Button className="w-full" onClick={() => router.push("/dashboard")}>
						View dashboard
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
