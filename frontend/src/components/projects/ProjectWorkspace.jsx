import { useEffect, useState } from 'react'
import SimulationSection from '../simulation/SimulationSection'
import SynthesisSection from '../synthesis/SynthesisSection'
import PhysicalDesignSection from '../physical/PhysicalDesignSection'

export default function ProjectWorkspace({ project, onBack }) {
    // ==================== PROJECT FILES ====================
    const [files, setFiles] = useState([])
    const [filesStatus, setFilesStatus] = useState('loading')

    // ==================== SIMULATION ====================
    const [simStatus, setSimStatus] = useState('idle')
    const [simOutput, setSimOutput] = useState('')

    // ==================== SYNTHESIS STATE ====================
    const [synthStatus, setSynthStatus] = useState('idle')
    const [synthOutput, setSynthOutput] = useState('')
    const [synthMetrics, setSynthMetrics] = useState(null)
    const [synthArtifacts, setSynthArtifacts] = useState([])
    const [synthArtifactsStatus, setSynthArtifactsStatus] = useState('idle')

    // ==================== PHYSICAL DESIGN STATE ====================
    const [physicalStatus, setPhysicalStatus] = useState('idle')
    const [physicalOutput, setPhysicalOutput] = useState('')
    const [physicalMetrics, setPhysicalMetrics] = useState(null)
    const [physicalArtifacts, setPhysicalArtifacts] = useState([])
    const [physicalArtifactsStatus, setPhysicalArtifactsStatus] = useState('idle')

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
                            throw new Error(
                                err.detail || `Simulation request failed (${res.status})`
                            )
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

    // ==================== SYNTHESIS WORKFLOW ====================
    const handleRunSynthesis = () => {
        setSynthStatus('running')
        setSynthOutput('')
        setSynthMetrics(null)
        setSynthArtifacts([])
        setSynthArtifactsStatus('loading')

        fetch(`/projects/${project.name}/synthesize`, {
            method: 'POST',
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Synthesis request failed')
                }
                return response.json()
            })
            .then((data) => {
                if (data.status === 'success') {
                    setSynthStatus('success')
                    setSynthOutput(
                        data.output || 'Synthesis completed successfully.'
                    )
                    setSynthMetrics(data.metrics || null)

                    fetch(`/projects/${project.name}/synthesis-artifacts`)
                        .then((response) => {
                            if (!response.ok) {
                                throw new Error(
                                    `Failed to load synthesis artifacts (${response.status})`
                                )
                            }

                            return response.json()
                        })
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

        fetch(`/projects/${project.name}/physical-design`, {
            method: 'POST',
        })
            .then((response) => {
                if (!response.ok) {
                    return response.json().then(
                        (err) => {
                            throw new Error(
                                err.detail ||
                                `Physical design request failed (${response.status})`
                            )
                        },
                        () => {
                            throw new Error(
                                `Physical design request failed (${response.status})`
                            )
                        }
                    )
                }

                return response.json()
            })
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