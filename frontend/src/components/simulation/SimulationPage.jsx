import { useState } from 'react'
import WaveformDisplay from './WaveformDisplay'
import useProjectSession from '../../hooks/useProjectSession'
import {
  runSimulation,
  getSimulationArtifacts,
  getWaveform,
} from '../../services/projectApi'

const fallbackProject = {
  name: 'counter',
  type: 'Verilog',
  top_module: 'counter',
}

export default function SimulationPage({ project, session, setSession }) {
  const currentProject = project || fallbackProject
  const projects = [currentProject]

  const {
    simStatus,
    setSimStatus,
    simOutput,
    setSimOutput,
    waveform,
    setWaveform,
    waveformStatus,
    setWaveformStatus,
    artifacts,
    setArtifacts,
    artifactsStatus,
    setArtifactsStatus
  } = useProjectSession(session, setSession)

  const runStatus = {
    [currentProject.name]: simStatus,
  }

  const results = {
    [currentProject.name]: {
      output: simOutput,
      waveform,
      artifacts,
    },
  }

  const handleRunSimulation = async (project) => {
    if (runStatus[project.name] === 'running') return

    setSimStatus('running')
    setSimOutput('')
    setArtifacts([])
    setArtifactsStatus('idle')
    setWaveform(null)
    setWaveformStatus('idle')

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
      } catch {
        setArtifacts([])
        setArtifactsStatus('error')
      }

      try {
        const waveformData = await getWaveform(project.name)
        setWaveform(waveformData.waveform || null)
        setWaveformStatus('loaded')
        console.log('SimulationPage waveform:', waveformData.waveform)
      } catch {
        setWaveform(null)
        setWaveformStatus('error')
      }

    } catch (error) {
      setSimStatus('failed')
      setSimOutput(error.message || 'Unable to run simulation.')
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
                      <span className="text-slate-300">
                        {project.top_module}
                      </span>
                    </p>
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
                      onClick={() => handleRunSimulation(project)}
                      disabled={status === 'running'}
                      className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {status === 'running'
                        ? 'Running...'
                        : 'Run Simulation'}
                    </button>
                  </div>
                </div>

                {result?.output && (
                  <div className="mt-5 border-t border-slate-800 pt-5">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Simulation Output
                    </h4>

                    <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-300">
                      {result.output}
                    </pre>
                  </div>
                )}

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
                            href={`/projects/${project.name}/artifacts/${artifact.name}`}
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

                {result?.waveform && (
                  <div className="mt-5 border-t border-slate-800 pt-5">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Waveform
                    </h4>

                    <div className="mt-4">
                      <WaveformDisplay waveform={result.waveform} />
                    </div>
                  </div>
                )}

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