import { useEffect, useState } from 'react'
import { createProjectSession } from '../../hooks/useProjectSession'
import useProjectSession from '../../hooks/useProjectSession'
import { runSynthesis, getSynthesisArtifacts } from '../../services/projectApi'

export default function SynthesisPage({
  projectSessions,
  setProjectSessions,
  onAddNewDesign,
}) {
  const [projects, setProjects] = useState([])
  const [projectsStatus, setProjectsStatus] = useState('loading')

  useEffect(() => {
    let isMounted = true

    fetch('/projects')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }
        return response.json()
      })
      .then((data) => {
        if (!isMounted) return

        const loadedProjects = data.projects || []
        setProjects(loadedProjects)
        setProjectsStatus('loaded')

        setProjectSessions((previous) => {
          const next = { ...previous }
          let changed = false

          loadedProjects.forEach((project) => {
            if (!next[project.name]) {
              next[project.name] = createProjectSession()
              changed = true
            }
          })

          return changed ? next : previous
        })
      })
      .catch(() => {
        if (isMounted) {
          setProjectsStatus('error')
        }
      })

    return () => {
      isMounted = false
    }
  }, [setProjectSessions])

  const getProjectSession = (projectName) => {
    return projectSessions[projectName]
  }

  const setProjectSession = (projectName, updater) => {
    setProjectSessions((previous) => ({
      ...previous,
      [projectName]:
        typeof updater === 'function'
          ? updater(previous[projectName])
          : updater,
    }))
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
            onClick={onAddNewDesign}
            className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
          >
            + Add New Design
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {projectsStatus === 'loading' && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
              Loading projects...
            </div>
          )}

          {projectsStatus === 'error' && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-400">
              Unable to load projects from backend.
            </div>
          )}

          {projectsStatus === 'loaded' && projects.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400">
              No projects found.
            </div>
          )}

          {projectsStatus === 'loaded' &&
            projects.map((project) => {
              const session = getProjectSession(project.name)

              if (!session) {
                return (
                  <div
                    key={project.name}
                    className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-400"
                  >
                    Preparing project session for {project.name}...
                  </div>
                )
              }

              return (
                <SynthesisProjectCard
                  key={project.name}
                  project={project}
                  session={session}
                  setSession={(updater) =>
                    setProjectSession(project.name, updater)
                  }
                />
              )
            })}
        </div>
      </div>
    </div>
  )
}

function SynthesisProjectCard({ project, session, setSession }) {
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

  const handleRunSynthesis = async () => {
    if (synthStatus === 'running') return

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

  const getStatusLabel = () => {
    if (synthStatus === 'running') return 'Running'
    if (synthStatus === 'success') return 'Completed'
    if (synthStatus === 'failed') return 'Failed'

    return 'Not Run'
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
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
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${synthStatus === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : synthStatus === 'failed'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : synthStatus === 'running'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
          >
            {getStatusLabel()}
          </span>

          <button
            type="button"
            onClick={handleRunSynthesis}
            disabled={synthStatus === 'running'}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {synthStatus === 'running'
              ? 'Running...'
              : 'Run Synthesis'}
          </button>
        </div>
      </div>

      {/* Results */}
      {synthMetrics && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Synthesis Results
          </h4>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <MetricCard
              label="Cell Count"
              value={synthMetrics.cell_count}
            />

            <MetricCard
              label="Area"
              value={synthMetrics.area}
            />

            <MetricCard
              label="Setup WNS"
              value={synthMetrics.setup_wns}
            />

            <MetricCard
              label="Hold WNS"
              value={synthMetrics.hold_wns}
            />

            <MetricCard
              label="TNS"
              value={synthMetrics.tns}
            />
          </div>
        </div>
      )}

      {/* Artifacts */}
      {synthArtifacts.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Artifacts
          </h4>

          <div className="mt-3 space-y-2">
            {synthArtifacts.map((artifact) => (
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

      {/* Output */}
      {synthOutput && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Synthesis Output
          </h4>

          <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-800 bg-slate-900 p-3 text-xs text-slate-400">
            {synthOutput}
          </pre>
        </div>
      )}
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