export default function Header() {
    return (
        <header className="flex h-14 w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-5">
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-600 font-bold text-white shadow-sm">
                    <svg
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect width="18" height="18" x="3" y="3" rx="2" />
                        <path d="M7 7h.01" />
                        <path d="M17 7h.01" />
                        <path d="M7 17h.01" />
                        <path d="M17 17h.01" />
                        <path d="M9 12h6" />
                    </svg>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold tracking-tight text-white">
                        CloudRTL
                    </span>

                    <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-800/60">
                        EDA Platform
                    </span>
                </div>
            </div>

            <div className="text-xs text-slate-400">
                Cloud-Based RTL Simulation Platform
            </div>
        </header>
    )
}