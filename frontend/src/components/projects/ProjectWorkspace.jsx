import { useEffect, useState } from 'react'
import SimulationSection from '../simulation/SimulationSection'
import SynthesisSection from '../synthesis/SynthesisSection'
import PhysicalDesignSection from '../physical/PhysicalDesignSection'
import useProjectSession from '../../hooks/useProjectSession'
import {
  getProjectFiles,
  addProjectFile,
  runSimulation,
  getSimulationArtifacts,
  getWaveform,
  runSynthesis,
  getSynthesisArtifacts,
  runPhysicalDesign
} from '../../services/projectApi'

export default function ProjectWorkspace({
  project,
  session,
  setSession,
  onBack,
}) {
  // ==================== PROJECT FILES ====================
  const [files, setFiles] = useState([])
  const [filesStatus, setFilesStatus] = useState('loading')

  // File management local state
  const [isAddingFile, setIsAddingFile] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('rtl')
  const [fileContent, setFileContent] = useState('')
  const [isSubmittingFile, setIsSubmittingFile] = useState(false)
  const [fileError, setFileError] = useState('')
  const [fileSuccess, setFileSuccess] = useState('')

  // ==================== PROJECT SESSION ====================
  const {
    simStatus,
    setSimStatus,
    simOutput,
    setSimOutput,

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

    physicalStatus,
    setPhysicalStatus,
    physicalOutput,
    setPhysicalOutput,
    physicalMetrics,
    setPhysicalMetrics,
    physicalArtifacts,
    setPhysicalArtifacts,
    physicalArtifactsStatus,
    setPhysicalArtifactsStatus,

    artifacts,
    setArtifacts,
    artifactsStatus,
    setArtifactsStatus,
    artifactsError,
    setArtifactsError,

    waveform,
    setWaveform,
    waveformStatus,
    setWaveformStatus,
    waveformError,
    setWaveformError,
  } = useProjectSession(session, setSession)

  // ==================== PROJECT FILES ====================
  const loadProjectFiles = () => {
    return getProjectFiles(project.name)
      .then((data) => {
        setFiles(data.files || [])
        setFilesStatus('loaded')
      })
      .catch(() => {
        setFilesStatus('error')
      })
  }

  useEffect(() => {
    let isMounted = true
    getProjectFiles(project.name)
      .then((data) => {
        if (!isMounted) return
        setFiles(data.files || [])
        setFilesStatus('loaded')
      })
      .catch(() => {
        if (isMounted) {
          setFilesStatus('error')
        }
      })

    setIsAddingFile(false)
    setFileSuccess('')
    setFileError('')
    setFileName('')
    setFileContent('')
    setFileType('rtl')

    return () => {
      isMounted = false
    }
  }, [project.name])

  const handleAddFile = async (e) => {
    e.preventDefault()
    setFileError('')
    setFileSuccess('')

    const trimmedName = fileName.trim()
    if (!trimmedName) {
      setFileError('File name cannot be empty.')
      return
    }

    setIsSubmittingFile(true)
    try {
      await addProjectFile(project.name, {
        name: trimmedName,
        type: fileType,
        content: fileContent,
      })

      setFileSuccess(`File "${trimmedName}" added successfully.`)
      setFileName('')
      setFileType('rtl')
      setFileContent('')
      setIsAddingFile(false)
      await loadProjectFiles()
    } catch (err) {
      setFileError(err.message || 'Failed to add file.')
    } finally {
      setIsSubmittingFile(false)
    }
  }

  const handleCancelAddFile = () => {
    setIsAddingFile(false)
    setFileName('')
    setFileType('rtl')
    setFileContent('')
    setFileError('')
  }

  // ==================== ARTIFACT HANDLING ====================
  const fetchArtifacts = () => {
    setArtifactsStatus('loading')
    setArtifactsError('')

    getSimulationArtifacts(project.name)
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

    getWaveform(project.name)
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

    runSimulation(project.name)
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

  // ==================== SYNTHESIS WORKFLOW ====================
  const handleRunSynthesis = () => {
    setSynthStatus('running')
    setSynthOutput('')
    setSynthMetrics(null)
    setSynthArtifacts([])
    setSynthArtifactsStatus('loading')

    runSynthesis(project.name)
      .then((data) => {
        if (data.status === 'success') {
          setSynthStatus('success')
          setSynthOutput(
            data.output || 'Synthesis completed successfully.'
          )
          setSynthMetrics(data.metrics || null)

          getSynthesisArtifacts(project.name)
            .then((artifactData) => {
              setSynthArtifacts(artifactData.artifacts || [])
              setSynthArtifactsStatus('loaded')
            })
            .catch(() => {
              setSynthArtifacts([])
              setSynthArtifactsStatus('error')
            })
        } else {
          setSynthStatus('failed')
          setSynthOutput(
            data.output || 'Synthesis failed.'
          )
        }
      })
      .catch((err) => {
        setSynthStatus('failed')
        setSynthOutput(
          err.message || 'Unable to run synthesis.'
        )
      })
  }

  // ==================== PHYSICAL DESIGN WORKFLOW ====================
  const handleRunPhysicalDesign = () => {
    if (physicalStatus === 'running') return

    setPhysicalStatus('running')
    setPhysicalOutput('')
    setPhysicalMetrics(null)
    setPhysicalArtifacts([])
    setPhysicalArtifactsStatus('idle')

    runPhysicalDesign(project.name)

      .then((data) => {
        if (data.status === 'success') {
          setPhysicalStatus('success')
          setPhysicalOutput(
            data.output || 'Physical design completed successfully.'
          )
          setPhysicalMetrics(data.metrics || null)

          setPhysicalArtifactsStatus('loaded')
          setPhysicalArtifacts(
            (data.artifacts || []).map((name) => ({
              name,
              type: name.endsWith('.def')
                ? 'def'
                : name.endsWith('.rpt')
                  ? 'report'
                  : 'routing-guide',
            }))
          )
        } else {
          setPhysicalStatus('failed')
          setPhysicalOutput(
            data.output || 'Physical design failed.'
          )
        }
      })
      .catch((err) => {
        setPhysicalStatus('failed')
        setPhysicalOutput(
          err.message || 'Unable to run physical design.'
        )
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

          <div className="flex items-center gap-3">
            {filesStatus === 'loaded' && (
              <span className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
            )}

            {!isAddingFile && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingFile(true)
                  setFileError('')
                  setFileSuccess('')
                }}
                className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/20"
              >
                + Add File
              </button>
            )}
          </div>
        </div>

        {fileSuccess && (
          <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
            {fileSuccess}
          </div>
        )}

        {isAddingFile && (
          <form onSubmit={handleAddFile} className="mt-4 space-y-4 rounded-lg border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Add New File</h3>
              <span className="text-xs text-slate-400">Supported: .v, .sv</span>
            </div>

            {fileError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {fileError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  File Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. counter.v"
                  disabled={isSubmittingFile}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  File Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  disabled={isSubmittingFile}
                  className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="rtl">RTL Source</option>
                  <option value="testbench">Testbench</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                File Content
              </label>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="// Enter Verilog RTL or Testbench code here..."
                rows={8}
                disabled={isSubmittingFile}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isSubmittingFile}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingFile ? 'Adding File...' : 'Add File'}
              </button>

              <button
                type="button"
                onClick={handleCancelAddFile}
                disabled={isSubmittingFile}
                className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

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
              <p className="text-sm text-slate-400">
                No files found for this project.
              </p>
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

      <SimulationSection
        project={project}
        simStatus={simStatus}
        simOutput={simOutput}
        handleRunSimulation={handleRunSimulation}
        artifacts={artifacts}
        artifactsStatus={artifactsStatus}
        artifactsError={artifactsError}
        waveform={waveform}
        waveformStatus={waveformStatus}
        waveformError={waveformError}
      />

      <SynthesisSection
        project={project}
        synthStatus={synthStatus}
        synthOutput={synthOutput}
        handleRunSynthesis={handleRunSynthesis}
        synthMetrics={synthMetrics}
        synthArtifacts={synthArtifacts}
        synthArtifactsStatus={synthArtifactsStatus}
      />

      <PhysicalDesignSection
        project={project}
        physicalStatus={physicalStatus}
        physicalOutput={physicalOutput}
        physicalMetrics={physicalMetrics}
        physicalArtifacts={physicalArtifacts}
        physicalArtifactsStatus={physicalArtifactsStatus}
        handleRunPhysicalDesign={handleRunPhysicalDesign}
      />

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