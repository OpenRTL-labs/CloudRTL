import WaveformDisplay from './WaveformDisplay'

export default function SimulationSection({
    project,
    simStatus,
    simOutput,
    handleRunSimulation,
    artifacts,
    artifactsStatus,
    artifactsError,
    waveform,
    waveformStatus,
    waveformError,
    fetchWaveform,
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Simulation
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-white">
                        RTL Simulation (Icarus Verilog)
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                        Compile and run testbench through Docker execution.
                    </p>
                </div>

                <div>
                    <button
                        type="button"
                        onClick={handleRunSimulation}
                        disabled={simStatus === 'running'}
                        className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {simStatus === 'running'
                            ? 'Running Simulation...'
                            : 'Run Simulation'}
                    </button>
                </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="font-medium text-slate-400">Status:</span>

                {simStatus === 'idle' && (
                    <span className="font-medium text-slate-300">
                        Ready
                    </span>
                )}

                {simStatus === 'running' && (
                    <span className="flex items-center gap-2 font-medium text-yellow-400">
                        <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                        Running...
                    </span>
                )}

                {simStatus === 'success' && (
                    <span className="flex items-center gap-2 font-medium text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Simulation Passed
                    </span>
                )}

                {simStatus === 'failed' && (
                    <span className="flex items-center gap-2 font-medium text-red-400">
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                        Simulation Failed
                    </span>
                )}
            </div>

            {simOutput && (
                <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Simulation Output
                    </p>

                    <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap">
                        {simOutput}
                    </pre>
                </div>
            )}

            {/* Artifacts */}
            <div className="mt-6 border-t border-slate-800 pt-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                            Artifacts
                        </p>

                        <h3 className="mt-1 text-base font-semibold text-white">
                            Simulation Artifacts
                        </h3>
                    </div>
                </div>

                {simStatus === 'idle' && (
                    <p className="mt-4 text-sm text-slate-400">
                        No simulation artifacts yet.
                    </p>
                )}

                {simStatus === 'running' && (
                    <p className="mt-4 text-sm text-slate-400">
                        Waiting for simulation to complete...
                    </p>
                )}

                {simStatus === 'failed' && (
                    <p className="mt-4 text-sm text-slate-400">
                        No artifacts available because the simulation failed.
                    </p>
                )}

                {simStatus === 'success' && artifactsStatus === 'loading' && (
                    <p className="mt-4 text-sm text-slate-400">
                        Loading simulation artifacts...
                    </p>
                )}

                {simStatus === 'success' && artifactsStatus === 'error' && (
                    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {artifactsError || 'Unable to load simulation artifacts.'}
                    </div>
                )}

                {simStatus === 'success' &&
                    artifactsStatus === 'loaded' &&
                    artifacts.length === 0 && (
                        <p className="mt-4 text-sm text-slate-400">
                            No artifacts were generated.
                        </p>
                    )}

                {simStatus === 'success' &&
                    artifactsStatus === 'loaded' &&
                    artifacts.length > 0 && (
                        <div className="mt-4 space-y-3">
                            {artifacts.map((artifact) => (
                                <div
                                    key={artifact.name}
                                    className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3"
                                >
                                    <div>
                                        <p className="font-mono text-sm font-medium text-slate-200">
                                            {artifact.name}
                                        </p>

                                        <span
                                            className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${artifact.type === 'waveform'
                                                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                                                : 'border-slate-700 bg-slate-800 text-slate-400'
                                                }`}
                                        >
                                            {artifact.type === 'waveform'
                                                ? 'Waveform'
                                                : artifact.type}
                                        </span>
                                    </div>

                                    <a
                                        href={`/projects/${project.name}/artifacts/${encodeURIComponent(
                                            artifact.name
                                        )}`}
                                        download={artifact.name}
                                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                                    >
                                        {artifact.type === 'waveform'
                                            ? 'Download VCD'
                                            : 'Download'}
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
            </div>

            {/* Waveform Viewer */}
            <div className="mt-6 border-t border-slate-800 pt-6">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Waveform Viewer
                    </p>

                    <h3 className="mt-1 text-base font-semibold text-white">
                        Digital Signal Waveforms
                    </h3>
                </div>

                {waveformStatus === 'idle' && (
                    <p className="mt-4 text-sm text-slate-400">
                        Run a successful simulation to view waveforms.
                    </p>
                )}

                {waveformStatus === 'loading' && (
                    <p className="mt-4 text-sm text-slate-400">
                        Loading waveform data...
                    </p>
                )}

                {waveformStatus === 'error' && (
                    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
                        {waveformError || 'Unable to load waveform data.'}
                    </div>
                )}

                {waveformStatus === 'loaded' &&
                    waveform &&
                    waveform.signals &&
                    waveform.signals.length === 0 && (
                        <p className="mt-4 text-sm text-slate-400">
                            No signals were found in the waveform.
                        </p>
                    )}

                {waveformStatus === 'loaded' &&
                    waveform &&
                    waveform.signals &&
                    waveform.signals.length > 0 && (
                        <WaveformDisplay waveform={waveform} />
                    )}
            </div>
        </div>
    )
}