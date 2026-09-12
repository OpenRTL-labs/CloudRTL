export default function PhysicalDesignSection({
  project,
  physicalStatus,
  physicalOutput,
  physicalMetrics,
  physicalArtifacts,
  physicalArtifactsStatus,
  handleRunPhysicalDesign,
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Physical Design
          </p>

          <h3 className="mt-1 text-base font-semibold text-white">
            ASIC Physical Implementation
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            Run floorplanning, placement, routing, and post-route timing
            analysis using OpenROAD.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunPhysicalDesign}
          disabled={physicalStatus === 'running'}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {physicalStatus === 'running'
            ? 'Running Physical Design...'
            : 'Run Physical Design'}
        </button>
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Status:</span>

          <span
            className={
              physicalStatus === 'success'
                ? 'font-semibold text-emerald-400'
                : physicalStatus === 'failed'
                  ? 'font-semibold text-red-400'
                  : physicalStatus === 'running'
                    ? 'font-semibold text-amber-400'
                    : 'font-semibold text-slate-300'
            }
          >
            {physicalStatus === 'success'
              ? 'Physical Design Passed'
              : physicalStatus === 'failed'
                ? 'Physical Design Failed'
                : physicalStatus === 'running'
                  ? 'Running'
                  : 'Ready'}
          </span>
        </div>
      </div>

      {/* Physical Design Metrics */}
      {physicalStatus === 'success' && physicalMetrics && (
        <div className="mt-6 border-t border-slate-800 pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Metrics
            </p>

            <h4 className="mt-1 text-base font-semibold text-white">
              Physical Design Results
            </h4>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Area */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Area</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.area ?? 'N/A'} µm²
              </p>
            </div>

            {/* Utilization */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Utilization</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.utilization ?? 'N/A'}%
              </p>
            </div>

            {/* Total Wire Length */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Total Wire Length</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.wire_length ?? 'N/A'} µm
              </p>
            </div>

            {/* Metal2 Wire Length */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Metal2 Wire Length</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.metal2_wire_length ?? 'N/A'} µm
              </p>
            </div>

            {/* Metal3 Wire Length */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Metal3 Wire Length</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.metal3_wire_length ?? 'N/A'} µm
              </p>
            </div>

            {/* Via Count */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Via Count</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.vias ?? 'N/A'}
              </p>
            </div>

            {/* Setup WNS */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Setup WNS</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.setup_wns !== null &&
                  physicalMetrics.setup_wns !== undefined
                  ? `${physicalMetrics.setup_wns >= 0 ? '+' : ''}${physicalMetrics.setup_wns}`
                  : 'N/A'}
              </p>
            </div>

            {/* Hold WNS */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Hold WNS</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.hold_wns !== null &&
                  physicalMetrics.hold_wns !== undefined
                  ? `${physicalMetrics.hold_wns >= 0 ? '+' : ''}${physicalMetrics.hold_wns}`
                  : 'N/A'}
              </p>
            </div>

            {/* TNS */}
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">TNS</p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {physicalMetrics.tns ?? 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Physical Design Output */}
      {physicalOutput && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Physical Design Output
          </p>

          <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-5 text-slate-300 whitespace-pre-wrap">
            {physicalOutput}
          </pre>
        </div>
      )}

      {/* Physical Design Artifacts */}
      <div className="mt-6 border-t border-slate-800 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Artifacts
          </p>

          <h4 className="mt-1 text-base font-semibold text-white">
            Physical Design Artifacts
          </h4>
        </div>

        {physicalStatus === 'idle' && (
          <p className="mt-4 text-sm text-slate-400">
            Run physical design to generate implementation artifacts.
          </p>
        )}

        {physicalStatus === 'running' && (
          <p className="mt-4 text-sm text-slate-400">
            Waiting for OpenROAD to complete...
          </p>
        )}

        {physicalStatus === 'failed' && (
          <p className="mt-4 text-sm text-slate-400">
            No physical design artifacts are available because the flow
            failed.
          </p>
        )}

        {physicalStatus === 'success' &&
          physicalArtifactsStatus === 'loaded' &&
          physicalArtifacts.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">
              No physical design artifacts were generated.
            </p>
          )}

        {physicalStatus === 'success' &&
          physicalArtifactsStatus === 'loaded' &&
          physicalArtifacts.length > 0 && (
            <div className="mt-4 space-y-3">
              {physicalArtifacts.map((artifact) => (
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
                    href={`/projects/${project.name}/physical-artifacts/${encodeURIComponent(
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
      </div>
    </div>
  )
}