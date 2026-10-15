import { useEffect, useState } from 'react'
import { createProjectSession } from '../../hooks/useProjectSession'
import useProjectSession from '../../hooks/useProjectSession'
import {
  getProjects,
  runPhysicalDesign,
  downloadPhysicalArtifact,
} from '../../services/projectApi'

export default function PhysicalDesignPage({
  projectSessions,
  setProjectSessions,
  onAddNewDesign,
}) {
  const [projects, setProjects] = useState([])
  const [projectsStatus, setProjectsStatus] = useState('loading')

  useEffect(() => {
    let isMounted = true

    getProjects()
      .then((data) => {
        if (!isMounted) return

        const loadedProjects = Array.isArray(data)
          ? data
          : data?.projects || []

        setProjects(loadedProjects)
        setProjectsStatus('loaded')

        // Keep a separate workflow session for every project.
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
      .catch((error) => {
        if (!isMounted) return
        console.error('Failed to load projects:', error)
        setProjectsStatus('error')
      })

    return () => {
      isMounted = false
    }
  }, [setProjectSessions])

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
          Physical Design
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Run floorplanning, placement, routing, and post-route timing
          analysis using OpenROAD.
        </p>
      </div>

      {/* Projects */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Existing Projects
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Select a project to run physical design.
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

          {projects.map((project) => {
            const session = projectSessions[project.name]

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
              <PhysicalDesignProjectCard
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

function PhysicalDesignProjectCard({ project, session, setSession }) {
  const [downloadError, setDownloadError] = useState('')

  const {
    physicalStatus,
    setPhysicalStatus,
    physicalOutput,
    setPhysicalOutput,
    physicalMetrics,
    setPhysicalMetrics,
    physicalArtifacts,
    setPhysicalArtifacts,
    setPhysicalArtifactsStatus,
  } = useProjectSession(session, setSession)

  const handleDownloadArtifact = async (artifactName) => {
    setDownloadError('')

    try {
      await downloadPhysicalArtifact(project.name, artifactName)
    } catch (error) {
      setDownloadError(error.message || 'Artifact download failed.')
    }
  }

  const handleRunPhysicalDesign = async () => {
    if (physicalStatus === 'running') return

    setPhysicalStatus('running')
    setPhysicalOutput('')
    setPhysicalMetrics(null)
    setPhysicalArtifacts([])
    setPhysicalArtifactsStatus('idle')
    setDownloadError('')

    try {
      const data = await runPhysicalDesign(project.name)

      if (data.status !== 'success') {
        throw new Error(data.output || 'Physical design failed.')
      }

      const artifacts = (data.artifacts || []).map((name) => ({
        name,
        type: name.endsWith('.def')
          ? 'def'
          : name.endsWith('.rpt')
            ? 'report'
            : 'routing-guide',
      }))

      setPhysicalOutput(
        data.output || 'Physical design completed successfully.',
      )
      setPhysicalMetrics(data.metrics || null)
      setPhysicalArtifacts(artifacts)
      setPhysicalArtifactsStatus('loaded')
      setPhysicalStatus('success')
    } catch (error) {
      setPhysicalStatus('failed')
      setPhysicalOutput(error.message || 'Unable to run physical design.')
      setPhysicalMetrics(null)
      setPhysicalArtifacts([])
      setPhysicalArtifactsStatus('error')
    }
  }

  const getStatusLabel = () => {
    if (physicalStatus === 'running') return 'Running'
    if (physicalStatus === 'success') return 'Completed'
    if (physicalStatus === 'failed') return 'Failed'
    return 'Not Run'
  }

  const metrics = physicalMetrics

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
      {/* Project Header */}
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

          <p className="mt-2 text-sm text-slate-400">
            Top Module:{' '}
            <span className="text-slate-300">{project.top_module}</span>
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Technology:{' '}
            <span className="text-slate-300">{project.technology}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${physicalStatus === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : physicalStatus === 'failed'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : physicalStatus === 'running'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
          >
            {getStatusLabel()}
          </span>

          <button
            type="button"
            onClick={handleRunPhysicalDesign}
            disabled={physicalStatus === 'running'}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {physicalStatus === 'running' ? 'Running...' : 'Run Physical Design'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Physical Design Metrics
          </h4>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="Area"
              value={metrics.area != null ? `${metrics.area} µm²` : 'N/A'}
            />
            <MetricCard
              label="Utilization"
              value={metrics.utilization != null ? `${metrics.utilization}%` : 'N/A'}
            />
            <MetricCard
              label="Total Wire Length"
              value={metrics.wire_length != null ? `${metrics.wire_length} µm` : 'N/A'}
            />
            <MetricCard
              label="Metal2 Wire Length"
              value={metrics.metal2_wire_length != null ? `${metrics.metal2_wire_length} µm` : 'N/A'}
            />
            <MetricCard
              label="Metal3 Wire Length"
              value={metrics.metal3_wire_length != null ? `${metrics.metal3_wire_length} µm` : 'N/A'}
            />
            <MetricCard
              label="Via Count"
              value={metrics.vias != null ? metrics.vias : 'N/A'}
            />
            <MetricCard label="Setup WNS" value={formatTiming(metrics.setup_wns)} />
            <MetricCard label="Hold WNS" value={formatTiming(metrics.hold_wns)} />
            <MetricCard label="TNS" value={metrics.tns != null ? metrics.tns : 'N/A'} />
          </div>
        </div>
      )}

      {/* Output */}
      {physicalOutput && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Physical Design Output
          </h4>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
            {physicalOutput}
          </pre>
        </div>
      )}

      {/* Artifacts */}
      {physicalArtifacts?.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Physical Design Artifacts
          </h4>

          <div className="mt-3 space-y-2">
            {physicalArtifacts.map((artifact) => (
              <div
                key={artifact.name}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
              >
                <div>
                  <span className="font-mono text-sm text-slate-300">
                    {artifact.name}
                  </span>
                  <span className="ml-3 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                    {artifact.type}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadArtifact(artifact.name)}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  Download
                </button>
              </div>
            ))}
          </div>

          {downloadError && (
            <p className="mt-3 text-sm text-red-400">{downloadError}</p>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs text-slate-500">{label}</p>

      <p className="mt-1 text-lg font-semibold text-slate-200">
        {value}
      </p>
    </div>
  )
}

function formatTiming(value) {
  if (value === null || value === undefined) {
    return 'N/A'
  }

  return `${value >= 0 ? '+' : ''}${value}`
}