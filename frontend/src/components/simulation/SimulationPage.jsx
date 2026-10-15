import { useEffect, useState } from 'react'
import { createProjectSession } from '../../hooks/useProjectSession'
import useProjectSession from '../../hooks/useProjectSession'
import WaveformDisplay from './WaveformDisplay'
import {
  runSimulation,
  getSimulationArtifacts,
  getWaveform,
  downloadSimulationArtifact,
  getProjects,
} from '../../services/projectApi'

export default function SimulationPage({
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

  const getProjectSession = (projectName) => projectSessions[projectName]

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
          Simulation
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Run RTL simulations and inspect generated artifacts and waveforms.
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
              Select a project to run simulation.
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
                <SimulationProjectCard
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

function SimulationProjectCard({ project, session, setSession }) {
  const [downloadError, setDownloadError] = useState('')

  const {
    simStatus,
    setSimStatus,
    simOutput,
    setSimOutput,
    waveform,
    setWaveform,
    setWaveformStatus,
    artifacts,
    setArtifacts,
    setArtifactsStatus,
  } = useProjectSession(session, setSession)

  const handleRunSimulation = async () => {
    if (simStatus === 'running') return

    setSimStatus('running')
    setSimOutput('')
    setArtifacts([])
    setArtifactsStatus('idle')
    setWaveform(null)
    setWaveformStatus('idle')
    setDownloadError('')

    try {
      const data = await runSimulation(project.name)

      if (data.status !== 'success') {
        throw new Error(data.output || 'Simulation failed.')
      }

      setSimOutput(data.output || 'Simulation completed successfully.')
      setSimStatus('success')

      try {
        const artifactData = await getSimulationArtifacts(project.name)
        setArtifacts(artifactData.artifacts || [])
        setArtifactsStatus('loaded')
      } catch (error) {
        console.error(
          `Failed to load simulation artifacts for ${project.name}:`,
          error,
        )
        setArtifacts([])
        setArtifactsStatus('error')
      }

      try {
        const waveformData = await getWaveform(project.name)
        setWaveform(waveformData.waveform || null)
        setWaveformStatus('loaded')
      } catch (error) {
        console.error(
          `Failed to load waveform for ${project.name}:`,
          error,
        )
        setWaveform(null)
        setWaveformStatus('error')
      }
    } catch (error) {
      setSimStatus('failed')
      setSimOutput(error.message || 'Unable to run simulation.')
    }
  }

  const handleDownloadArtifact = async (artifactName) => {
    setDownloadError('')

    try {
      await downloadSimulationArtifact(project.name, artifactName)
    } catch (error) {
      setDownloadError(error.message || 'Artifact download failed.')
    }
  }

  const getStatusLabel = () => {
    if (simStatus === 'running') return 'Running'
    if (simStatus === 'success') return 'Completed'
    if (simStatus === 'failed') return 'Failed'
    return 'Not Run'
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5">
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
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-md border px-2.5 py-1 text-xs font-medium ${simStatus === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : simStatus === 'failed'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : simStatus === 'running'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
          >
            {getStatusLabel()}
          </span>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={simStatus === 'running'}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {simStatus === 'running' ? 'Running...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {simOutput && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">
            Simulation Output
          </h4>

          <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
            {simOutput}
          </pre>
        </div>
      )}

      {artifacts?.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">Artifacts</h4>

          <div className="mt-3 space-y-2">
            {artifacts.map((artifact) => (
              <div
                key={artifact.name}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
              >
                <span className="font-mono text-sm text-slate-300">
                  {artifact.name}
                </span>

                <button
                  type="button"
                  onClick={() => handleDownloadArtifact(artifact.name)}
                  className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
                >
                  Download
                </button>
              </div>
            ))}

            {downloadError && (
              <p className="mt-3 text-sm text-red-400">{downloadError}</p>
            )}
          </div>
        </div>
      )}

      {waveform && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <h4 className="text-sm font-semibold text-slate-200">Waveform</h4>

          <div className="mt-4">
            <WaveformDisplay waveform={waveform} />
          </div>
        </div>
      )}
    </div>
  )
}
