export default function Sidebar({
    navItems,
    activeTab,
    onNavigate,
    backendStatus,
}) {
    return (
        <aside className="w-60 flex-shrink-0 border-r border-slate-800 bg-slate-900/90 flex flex-col justify-between p-3">
            <div className="space-y-1">
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Navigation
                </div>

                {navItems.map((item) => {
                    const isActive = activeTab === item.id

                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onNavigate(item.id)}
                            className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <span
                                className={`h-2 w-2 rounded-full ${isActive ? 'bg-cyan-400' : 'bg-slate-600'
                                    }`}
                            />

                            {item.label}
                        </button>
                    )
                })}
            </div>

            <div className="rounded-md border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-400">
                <p className="font-medium text-slate-300">Environment</p>

                <p className="mt-1 text-slate-400">
                    Workspace Ready
                </p>

                <p className="mt-2">
                    Backend:{' '}
                    <span
                        className={
                            backendStatus === 'connected'
                                ? 'text-emerald-400'
                                : backendStatus === 'disconnected'
                                    ? 'text-red-400'
                                    : 'text-yellow-400'
                        }
                    >
                        {backendStatus === 'connected'
                            ? 'Connected'
                            : backendStatus === 'disconnected'
                                ? 'Disconnected'
                                : 'Checking...'}
                    </span>
                </p>
            </div>
        </aside>
    )
}