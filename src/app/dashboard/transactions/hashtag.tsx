import type { PatchCache } from "./types";
import { useEffect, useState, useRef, useMemo } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { fuzzyScore } from "./utils";

export default function HashtagCell({
	transactionId,
	hashtags,
	allHashtags,
	patchCache,
}: {
	transactionId: string;
	hashtags: { hashtag: { name: string; normalizedName: string } }[];
	allHashtags: { name: string; normalizedName: string }[];
	patchCache: PatchCache;
}) {
	const [editing, setEditing] = useState(false);
	const [inputValue, setInputValue] = useState("");
	const [savingTags, setSavingTags] = useState<Set<string>>(new Set());
	const [removedTags, setRemovedTags] = useState<Set<string>>(new Set());
	const [activeIndex, setActiveIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);

	const setHashtags = api.hashtag.setOnTransaction.useMutation({
		onSuccess: (_, vars) => {
			const newHashtags = vars.hashtags.map((name) => ({
				hashtag: { name, normalizedName: name.toLowerCase() },
			}));
			patchCache((tx) =>
				tx.id === vars.transactionId ? { ...tx, hashtags: newHashtags } : tx,
			);
		},
		onError: () => {
			toast.error("Failed to update hashtags");
			setSavingTags(new Set());
		},
	});

	const serverNames = hashtags.map((h) => h.hashtag.name);
	const displayNames = [
		...new Set([...serverNames, ...Array.from(savingTags)]),
	].filter((n) => !removedTags.has(n));

	// Suggestions: fuzzy-match existing hashtags, exclude ones already on this tx
	const suggestions = useMemo(() => {
		const query = inputValue.trim().replace(/^#/, "");
		if (!query) return [];
		const serverNamesLower = new Set(serverNames.map((n) => n.toLowerCase()));
		return allHashtags
			.filter((h) => !serverNamesLower.has(h.name.toLowerCase()))
			.map((h) => ({ name: h.name, score: fuzzyScore(h.name, query) }))
			.filter((x): x is { name: string; score: number } => x.score !== null)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5)
			.map((x) => x.name);
	}, [inputValue, allHashtags, serverNames]);

	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	function commit(name: string) {
		const raw = name.trim().replace(/^#/, "");
		if (!raw) {
			setEditing(false);
			return;
		}
		setSavingTags((prev) => new Set(prev).add(raw));
		const next = [...new Set([...serverNames, raw])];
		setHashtags.mutate(
			{ transactionId, hashtags: next },
			{
				onSettled: () => {
					setSavingTags((prev) => {
						const s = new Set(prev);
						s.delete(raw);
						return s;
					});
				},
			},
		);
		setInputValue("");
		setEditing(false);
	}

	function removeTag(name: string) {
		setRemovedTags((prev) => new Set(prev).add(name));
		const next = serverNames.filter((n) => n !== name);
		setHashtags.mutate(
			{ transactionId, hashtags: next },
			{
				onError: () => {
					setRemovedTags((prev) => {
						const s = new Set(prev);
						s.delete(name);
						return s;
					});
					toast.error("Failed to delete hashtag. Please try again later.");
				},
				onSuccess: () => {
					setRemovedTags((prev) => {
						const s = new Set(prev);
						s.delete(name);
						return s;
					});
				},
			},
		);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			const chosen = activeIndex >= 0 ? suggestions[activeIndex] : inputValue;
			commit(chosen ?? "");
		} else if (e.key === "Escape") {
			setEditing(false);
			setInputValue("");
		}
	}

	function handleBlur() {
		// Small delay so clicks on suggestion items register first
		setTimeout(() => {
			setEditing(false);
			setInputValue("");
		}, 120);
	}

	return (
		<div className="flex min-w-[120px] flex-wrap items-center gap-1">
			{displayNames.map((name) => {
				const isSaving = savingTags.has(name);
				return (
					<span
						key={name}
						className={[
							"inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
							isSaving
								? "animate-pulse bg-muted text-muted-foreground/50"
								: "bg-muted text-muted-foreground",
						].join(" ")}
					>
						#{name}
						{!isSaving && (
							<button
								type="button"
								aria-label={`Remove #${name}`}
								className="ml-0.5 transition-colors hover:text-foreground"
								onClick={() => removeTag(name)}
							>
								<X className="h-2.5 w-2.5" />
							</button>
						)}
					</span>
				);
			})}
			{editing ? (
				<div className="relative">
					<input
						ref={inputRef}
						className="w-20 rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-ring"
						onBlur={handleBlur}
						onChange={(e) => {
							setInputValue(e.target.value);
							setActiveIndex(-1);
						}}
						onKeyDown={handleKeyDown}
						placeholder="tag"
						value={inputValue}
					/>
					{suggestions.length > 0 && (
						<ul className="absolute left-0 top-full z-50 mt-1 min-w-[8rem] rounded-md border bg-popover py-1 shadow-md">
							{suggestions.map((name, i) => (
								<li key={name}>
									<button
										type="button"
										className={[
											"w-full px-3 py-1 text-left text-xs transition-colors",
											i === activeIndex
												? "bg-accent text-accent-foreground"
												: "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
										].join(" ")}
										onMouseDown={(e) => {
											e.preventDefault();
											commit(name);
										}}
									>
										#{name}
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			) : (
				<button
					type="button"
					className="rounded py-0.5 pl-2 pr-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground/80"
					onClick={() => {
						setEditing(true);
						setInputValue("");
					}}
				>
					+ tag
				</button>
			)}
		</div>
	);
}
