import { runSynthesis, getSynthesisArtifacts } from '../../services/projectApi'
import useProjectSession from '../../hooks/useProjectSession'

const projects = [
  {
    name: 'counter',
    type: 'Verilog',
    top_module: 'counter',
    technology: 'Nangate45',
  },
]

export default function SynthesisPage({ session, setSession }) {
  const {
    synthStatus,
    setSynthStatus,
    synthOutput,
    setSynthOutput,
    synthMetrics,
    setSynthMetrics,
    synthArtifacts,
    setSynthArtifacts,
    synthArtifactsStatus,
    setSynthArtifactsStatus,
  } = useProjectSession(session, setSession)

  const runStatus = {
    counter: synthStatus,
  }

  const results = {
    counter: {
      metrics: synthMetrics,
      output: synthOutput,
      artifacts: synthArtifacts,
    },
  }

  const handleRunSynthesis = async (project) => {
    if (runStatus[project.name] === 'running') return

    setSynthStatus('running')
    setSynthOutput('')
    setSynthMetrics(null)
    setSynthArtifacts([])
    setSynthArtifactsStatus('loading')

    try {
      const data = await runSynthesis(project.name)

      if (data.status !== 'success') {
        throw new Error(data.output || 'Synthesis failed.')
      }

      setSynthOutput(data.output || 'Synthesis completed successfully.')
      setSynthMetrics(data.metrics || null)
      setSynthStatus('success')

      try {
        const artifactData = await getSynthesisArtifacts(project.name)
        setSynthArtifacts(artifactData.artifacts || [])
        setSynthArtifactsStatus('loaded')
      } catch {
        setSynthArtifacts([])
        setSynthArtifactsStatus('error')
      }
    } catch (error) {
      setSynthStatus('failed')
      setSynthOutput(
        error.message || 'Unable to run synthesis.'
      )
      setSynthArtifacts([])
      setSynthArtifactsStatus('error')
    }
  }

  const getStatusLabel = (projectName) => {
    const status = runStatus[projectName]

    if (status === 'running') return 'Running'
    if (status === 'success') return 'Completed'
    if (status === 'failed') return 'Failed'

    return 'Not Run'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
          EDA Workflow
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Synthesis
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Synthesize existing RTL projects and inspect area and timing results.
        </p>
      </div>

      {/* Existing Projects */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Existing Projects
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Select a project to run synthesis.
            </p>
          </div>

          <button
            type="button"
            className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
          >
            + Add New Design
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {projects.map((project) => {
            const status = runStatus[project.name]
            const result = results[project.name]

            return (
              <div
                key={project.name}
                className="rounded-lg border border-slate-800 bg-slate-950/70 p-5"
              >
                {/* Project information */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-mono text-base font-semibold text-white">
                        {project.name}
                      </h3>

                      <span className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-400">
                        {project.type}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-400">
                      <span>
                        Top Module:{' '}
                        <span className="text-slate-300">
                          {project.top_module}
                        </span>
                      </span>

                      <span>
                        Technology:{' '}
                        <span className="text-slate-300">
                          {project.technology}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${status === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : status === 'failed'
                          ? 'border-red-500/30 bg-red-500/10 text-red-400'
                          : status === 'running'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                    >
                      {getStatusLabel(project.name)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRunSynthesis(project)}
                      disabled={status === 'running'}
                      className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {status === 'running'
                        ? 'Running...'
                        : 'Run Synthesis'}
                    </button>
                  </div>
                </div>

                {/* Results */}
                {result?.metrics && (
                  <div className="mt-5 border-t border-slate-800 pt-5">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Synthesis Results
                    </h4>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                      <MetricCard
                        label="Cell Count"
                        value={result.metrics.cell_count}
                      />

                      <MetricCard
                        label="Area"
                        value={result.metrics.area}
                      />

                      <MetricCard
                        label="Setup WNS"
                        value={result.metrics.setup_wns}
                      />

                      <MetricCard
                        label="Hold WNS"
                        value={result.metrics.hold_wns}
                      />

                      <MetricCard
                        label="TNS"
                        value={result.metrics.tns}
                      />
                    </div>
                  </div>
                )}

                {/* Artifacts */}
                {result?.artifacts?.length > 0 && (
                  <div className="mt-5 border-t border-slate-800 pt-5">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Artifacts
                    </h4>

                    <div className="mt-3 space-y-2">
                      {result.artifacts.map((artifact) => (
                        <div
                          key={artifact.name}
                          className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
                        >
                          <span className="font-mono text-sm text-slate-300">
                            {artifact.name}
                          </span>

                          <a
                            href={`/projects/${project.name}/synthesis-artifacts/${artifact.name}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                          >
                            Download
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {result?.error && (
                  <div className="mt-5 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                    {result.error}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">
        {value ?? '—'}
      </p>
    </div>
  )
}