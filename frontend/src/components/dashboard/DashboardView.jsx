export default function DashboardView({ activeTab, navItems }) {
    return (
        <>
            {/* Welcome Section */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-sm">
                <div className="max-w-2xl space-y-3">
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        Welcome to CloudRTL
                    </h1>

                    <p className="text-slate-400 leading-relaxed text-sm">
                        A cloud-native Electronic Design Automation (EDA) workspace for
                        RTL design, verification, logic synthesis, and physical layout.
                    </p>
                </div>

                {/* Workspace Placeholder Cards */}
                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                            Simulation
                        </div>

                        <h3 className="mt-2 font-medium text-slate-200">
                            RTL Simulation & Waveforms
                        </h3>

                        <p className="mt-1 text-xs text-slate-400 leading-normal">
                            Run Verilog and SystemVerilog testbenches in the cloud.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                            Synthesis
                        </div>

                        <h3 className="mt-2 font-medium text-slate-200">
                            Logic Synthesis
                        </h3>

                        <p className="mt-1 text-xs text-slate-400 leading-normal">
                            Translate RTL to optimized gate-level netlists.
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
                        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                            Physical Design
                        </div>

                        <h3 className="mt-2 font-medium text-slate-200">
                            ASIC Implementation
                        </h3>

                        <p className="mt-1 text-xs text-slate-400 leading-normal">
                            Place and route flow with standard cell technology.
                        </p>
                    </div>
                </div>
            </div>

            {/* Active Section Placeholder */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 text-center text-sm text-slate-400">
                Active view:{' '}
                <span className="font-semibold text-slate-200">
                    {navItems.find((n) => n.id === activeTab)?.label}
                </span>{' '}
                — workspace modules will be mounted here.
            </div>
        </>
    )
}