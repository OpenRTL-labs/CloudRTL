export default function SynthesisSection({
    project,
    synthStatus,
    synthOutput,
    handleRunSynthesis,
    synthMetrics,
    synthArtifacts,
    synthArtifactsStatus,
}) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Synthesis
                    </p>

                    <h3 className="mt-1 text-base font-semibold text-white">
                        RTL Synthesis
                    </h3>

                    <p className="mt-1 text-sm text-slate-400">
                        Convert the RTL design into a synthesized gate-level netlist.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleRunSynthesis}
                    disabled={synthStatus === 'running'}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {synthStatus === 'running'
                        ? 'Running Synthesis...'
                        : 'Run Synthesis'}
                </button>
            </div>

            <div className="mt-5">
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400">Status:</span>

                    <span
                        className={
                            synthStatus === 'success'
                                ? 'font-semibold text-emerald-400'
                                : synthStatus === 'failed'
                                    ? 'font-semibold text-red-400'
                                    : synthStatus === 'running'
                                        ? 'font-semibold text-amber-400'
                                        : 'font-semibold text-slate-300'
                        }
                    >
                        {synthStatus === 'success'
                            ? 'Synthesis Passed'
                            : synthStatus === 'failed'
                                ? 'Synthesis Failed'
                                : synthStatus === 'running'
                                    ? 'Running'
                                    : 'Ready'}
                    </span>
                </div>
            </div>

            {synthOutput && (
                <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Synthesis Output
                    </p>

                    <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-5 text-slate-300">
                        {synthOutput}
                    </pre>
                </div>
            )}

            {/* Synthesis Metrics */}
            {synthStatus === 'success' && synthMetrics && (
                <div className="mt-6 border-t border-slate-800 pt-6">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                            Metrics
                        </p>

                        <h4 className="mt-1 text-base font-semibold text-white">
                            Synthesis Results
                        </h4>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

                        {/* Cell Count */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">Cell Count</p>
                            <p className="mt-1 text-lg font-semibold text-slate-200">
                                {synthMetrics.cell_count ?? 'N/A'}
                            </p>
                        </div>

                        {/* Area */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">Area</p>
                            <p className="mt-1 text-lg font-semibold text-slate-200">
                                {synthMetrics.area ?? 'N/A'} µm²
                            </p>
                        </div>

                        {/* Setup WNS */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">Setup WNS</p>
                            <p className="mt-1 text-lg font-semibold text-slate-200">
                                {synthMetrics.setup_wns !== null &&
                                    synthMetrics.setup_wns !== undefined
                                    ? `${synthMetrics.setup_wns >= 0 ? '+' : ''}${synthMetrics.setup_wns}`
                                    : 'N/A'}
                            </p>
                        </div>

                        {/* Hold WNS */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">Hold WNS</p>
                            <p className="mt-1 text-lg font-semibold text-slate-200">
                                {synthMetrics.hold_wns !== null &&
                                    synthMetrics.hold_wns !== undefined
                                    ? `${synthMetrics.hold_wns >= 0 ? '+' : ''}${synthMetrics.hold_wns}`
                                    : 'N/A'}
                            </p>
                        </div>

                        {/* TNS */}
                        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                            <p className="text-xs text-slate-500">TNS</p>
                            <p className="mt-1 text-lg font-semibold text-slate-200">
                                {synthMetrics.tns ?? 'N/A'}
                            </p>
                        </div>

                    </div>
                </div>
            )}

            {/* Synthesis Artifacts */}
            <div className="mt-6 border-t border-slate-800 pt-6">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                        Artifacts
                    </p>

                    <h4 className="mt-1 text-base font-semibold text-white">
                        Synthesis Artifacts
                    </h4>
                </div>

                {synthStatus === 'idle' && (
                    <p className="mt-4 text-sm text-slate-400">
                        Run synthesis to generate synthesis artifacts.
                    </p>
                )}

                {synthStatus === 'running' && (
                    <p className="mt-4 text-sm text-slate-400">
                        Generating synthesis artifacts...
                    </p>
                )}

                {synthStatus === 'success' &&
                    synthArtifactsStatus === 'loaded' &&
                    synthArtifacts.length === 0 && (
                        <p className="mt-4 text-sm text-slate-400">
                            No synthesis artifacts were generated.
                        </p>
                    )}

                {synthStatus === 'success' &&
                    synthArtifactsStatus === 'loaded' &&
                    synthArtifacts.length > 0 && (
                        <div className="mt-4 space-y-3">
                            {synthArtifacts.map((artifact) => (
                                <div
                                    key={artifact.name}
                                    className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3"
                                >
                                    <div>
                                        <p className="font-mono text-sm font-medium text-slate-200">
                                            {artifact.name}
                                        </p>

                                        <span className="mt-1 inline-block rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-slate-400">
                                            {artifact.type}
                                        </span>
                                    </div>

                                    <a
                                        href={`/projects/${project.name}/synthesis-artifacts/${encodeURIComponent(
                                            artifact.name
                                        )}`}
                                        download={artifact.name}
                                        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
                                    >
                                        Download
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}

                {synthStatus === 'success' &&
                    synthArtifactsStatus === 'error' && (
                        <p className="mt-4 text-sm text-red-400">
                            Synthesis completed, but the artifact list could not be loaded.
                        </p>
                    )}
            </div>
        </div>
    )
}