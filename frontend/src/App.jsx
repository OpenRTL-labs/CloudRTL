import { useEffect, useState } from 'react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'synthesis', label: 'Synthesis' },
  { id: 'physical-design', label: 'Physical Design' },
]
// ==================== WAVEFORM VIEWER ====================
function WaveformDisplay({ waveform }) {
  const signals = waveform.signals || []

  const maxTime = Math.max(
    1,
    ...signals.flatMap((signal) =>
      (signal.changes || []).map((change) => change.time)
    )
  )

  const waveformWidth = 700
  const rowHeight = 56
  const labelWidth = 120
  const totalHeight = Math.max(80, signals.length * rowHeight)

  const getX = (time) => (time / maxTime) * waveformWidth

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
      <div className="min-w-[900px] p-4">
        <div className="mb-3 flex items-center text-xs text-slate-500">
          <div
            className="flex-shrink-0"
            style={{ width: `${labelWidth}px` }}
          >
            Signal
          </div>

          <div className="relative h-6 flex-1">
            <span className="absolute left-0">0</span>
            <span
              className="absolute"
              style={{
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              {Math.round(maxTime / 2)}
            </span>
            <span className="absolute right-0">{maxTime}</span>
          </div>
        </div>

        <div
          className="relative"
          style={{ height: `${totalHeight}px` }}
        >
          {signals.map((signal, signalIndex) => {
            const changes = signal.changes || []

            return (
              <div
                key={signal.name}
                className="absolute left-0 right-0 flex items-center border-t border-slate-800"
                style={{
                  top: `${signalIndex * rowHeight}px`,
                  height: `${rowHeight}px`,
                }}
              >
                <div
                  className="flex-shrink-0 truncate pr-3 font-mono text-xs font-medium text-slate-300"
                  style={{ width: `${labelWidth}px` }}
                  title={signal.name}
                >
                  {signal.name}
                </div>

                <svg
                  viewBox={`0 0 ${waveformWidth} 40`}
                  preserveAspectRatio="none"
                  className="h-10 flex-1"
                >
                  {changes.length > 0 &&
                    changes.map((change, index) => {
                      const nextChange = changes[index + 1]
                      const startX = getX(change.time)
                      const endX = nextChange
                        ? getX(nextChange.time)
                        : waveformWidth

                      const isHigh = change.value === '1'

                      const y = isHigh ? 8 : 28

                      return (
                        <g key={`${signal.name}-${change.time}-${index}`}>
                          <line
                            x1={startX}
                            y1={y}
                            x2={endX}
                            y2={y}
                            stroke="currentColor"
                            strokeWidth="2"
                          />

                          {nextChange && (
                            <line
                              x1={endX}
                              y1={y}
                              x2={endX}
                              y2={nextChange.value === '1' ? 8 : 28}
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          )}
                        </g>
                      )
                    })}
                </svg>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
function ProjectWorkspace({ project, onBack }) {
  // ==================== PROJECT FILES ====================
  const [files, setFiles] = useState([])
  const [filesStatus, setFilesStatus] = useState('loading')
  // ==================== SIMULATION ====================
  const [simStatus, setSimStatus] = useState('idle')
  const [simOutput, setSimOutput] = useState('')
  // ==================== ARTIFACTS ====================
  const [artifacts, setArtifacts] = useState([])
  const [artifactsStatus, setArtifactsStatus] = useState('idle')
  const [artifactsError, setArtifactsError] = useState('')
  // ==================== WAVEFORM ====================
  const [waveform, setWaveform] = useState(null)
  const [waveformStatus, setWaveformStatus] = useState('idle')
  const [waveformError, setWaveformError] = useState('')

  // ==================== PROJECT FILES ====================
  useEffect(() => {
    let isMounted = true

    fetch(`/projects/${project.name}/files`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch project files')
        }
        return response.json()
      })
      .then((data) => {
        if (!isMounted) return
        if (data.detail) {
          throw new Error(data.detail)
        }
        setFiles(data.files || [])
        setFilesStatus('loaded')
      })
      .catch(() => {
        if (isMounted) {
          setFilesStatus('error')
        }
      })

    return () => {
      isMounted = false
    }
  }, [project.name])

  // ==================== ARTIFACT HANDLING ====================
  const fetchArtifacts = () => {
    setArtifactsStatus('loading')
    setArtifactsError('')

    fetch(`/projects/${project.name}/artifacts`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch simulation artifacts')
        }
        return response.json()
      })
      .then((data) => {
        setArtifacts(data.artifacts || [])
        setArtifactsStatus('loaded')
      })
      .catch((err) => {
        setArtifacts([])
        setArtifactsStatus('error')
        setArtifactsError(err.message || 'Unable to load simulation artifacts.')
      })
  }

  // ==================== WAVEFORM DATA ====================

  const fetchWaveform = () => {
    setWaveformStatus('loading')
    setWaveformError('')

    fetch(`/projects/${project.name}/waveform`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch waveform data')
        }
        return response.json()
      })
      .then((data) => {
        setWaveform(data.waveform || null)
        setWaveformStatus('loaded')
      })
      .catch((err) => {
        setWaveform(null)
        setWaveformStatus('error')
        setWaveformError(err.message || 'Unable to load waveform data.')
      })
  }

  // ==================== SIMULATION ====================

  const handleRunSimulation = () => {
    if (simStatus === 'running') return
    setSimStatus('running')
    setSimOutput('')
    setArtifacts([])
    setArtifactsStatus('idle')
    setArtifactsError('')
    setWaveform(null)
    setWaveformStatus('idle')
    setWaveformError('')

    fetch(`/projects/${project.name}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then(
            (err) => {
              throw new Error(err.detail || `Simulation request failed (${res.status})`)
            },
            () => {
              throw new Error(`Simulation request failed (${res.status})`)
            }
          )
        }
        return res.json()
      })
      .then((data) => {
        if (data.status === 'success') {
          setSimStatus('success')
          setSimOutput(data.output || 'Simulation passed with no output.')
          fetchArtifacts()
          fetchWaveform()
        } else {
          setSimStatus('failed')
          setSimOutput(data.output || 'Simulation failed.')
        }
      })
      .catch((err) => {
        setSimStatus('failed')
        setSimOutput(err.message || 'Simulation execution failed.')
      })
  }

  return (
    <div className="space-y-6">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          ← Back to Projects
        </button>

        <h1 className="text-2xl font-bold tracking-tight text-white">
          {project.name}
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Project workspace
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              {project.type}
            </p>

            <h2 className="mt-2 text-xl font-semibold text-white">
              {project.name}
            </h2>
          </div>

          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
            {project.status}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Technology</p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {project.technology}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Top Module</p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              {project.top_module}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs text-slate-500">Workspace</p>
            <p className="mt-1 text-sm font-medium text-slate-200">
              RTL + EDA
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Project Files
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Source &amp; Testbench
            </h2>
          </div>
          {filesStatus === 'loaded' && (
            <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>

        {filesStatus === 'loading' && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
            Loading project files...
          </div>
        )}

        {filesStatus === 'error' && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            Unable to load project files from backend.
          </div>
        )}

        {filesStatus === 'loaded' && (
          <div className="mt-4 space-y-3">
            {files.length === 0 ? (
              <p className="text-sm text-slate-400">No files found for this project.</p>
            ) : (
              files.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-slate-200">
                      {file.name}
                    </span>
                  </div>

                  <span
                    className={`rounded border px-2.5 py-1 text-xs font-medium uppercase tracking-wider ${file.type === 'rtl'
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                      : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                      }`}
                  >
                    {file.type === 'rtl'
                      ? 'RTL'
                      : file.type === 'testbench'
                        ? 'Testbench'
                        : file.type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Simulation Section */}
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
              {simStatus === 'running' ? 'Running Simulation...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-400">Status:</span>
          {simStatus === 'idle' && (
            <span className="font-medium text-slate-300">Ready</span>
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
        {/*Artifacts*/}
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
            {/*Waveform Viewer */}
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
      </div>

      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Project Workspace
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-200">
          EDA workflow modules
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Simulation, synthesis, physical design, reports, and artifacts will
          be available here as the platform develops.
        </p>
      </div>
    </div>
  )
}

function ProjectsView({ onOpenProject }) {
  const [projects, setProjects] = useState([])
  const [projectsStatus, setProjectsStatus] = useState('loading')

  useEffect(() => {
    fetch('/projects')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch projects')
        }
        return response.json()
      })
      .then((data) => {
        setProjects(data.projects)
        setProjectsStatus('loaded')
      })
      .catch(() => {
        setProjectsStatus('error')
      })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Projects
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage your RTL and EDA workspaces.
        </p>
      </div>

      {projectsStatus === 'loading' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">
          Loading projects...
        </div>
      )}

      {projectsStatus === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
          Unable to load projects from backend.
        </div>
      )}

      {projectsStatus === 'loaded' &&
        projects.map((project) => (
          <div
            key={project.name}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                  {project.type}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {project.name}
                </h2>
              </div>

              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                {project.status}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">Technology</p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  {project.technology}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">Top Module</p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  {project.top_module}
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-xs text-slate-500">Workspace</p>
                <p className="mt-1 text-sm font-medium text-slate-200">
                  RTL + EDA
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenProject(project)}
              className="mt-6 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
            >
              Open Project
            </button>
          </div>
        ))}

      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          New Workspace
        </p>

        <h2 className="mt-2 text-lg font-semibold text-slate-200">
          Create New Project
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Start a new RTL and EDA workspace.
        </p>

        <button
          type="button"
          className="mt-5 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
        >
          Create Project
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [backendStatus, setBackendStatus] = useState('checking')
  const [activeProject, setActiveProject] = useState(null)

  useEffect(() => {
    fetch('/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Backend unavailable')
        }
        return response.json()
      })
      .then((data) => {
        setBackendStatus(data.status === 'healthy' ? 'connected' : 'disconnected')
      })
      .catch(() => {
        setBackendStatus('disconnected')
      })
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 antialiased font-sans select-none">
      {/* Top Header */}
      <header className="flex h-14 w-full items-center justify-between border-b border-slate-800 bg-slate-900 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan-600 font-bold text-white shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7h.01" />
              <path d="M17 7h.01" />
              <path d="M7 17h.01" />
              <path d="M17 17h.01" />
              <path d="M9 12h6" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight text-white">
              CloudRTL
            </span>
            <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-medium text-cyan-400 border border-cyan-800/60">
              EDA Platform
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          Cloud-Based RTL Simulation Platform
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
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
                  onClick={() => setActiveTab(item.id)}
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
            <p className="mt-1 text-slate-400">Workspace Ready</p>
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

        {/* Main Workspace Area */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {activeProject ? (
              <ProjectWorkspace
                key={activeProject.name}
                project={activeProject}
                onBack={() => setActiveProject(null)}
              />
            ) : activeTab === 'projects' ? (
              <ProjectsView onOpenProject={setActiveProject} />
            ) : (
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
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
