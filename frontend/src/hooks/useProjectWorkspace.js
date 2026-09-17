import { useEffect, useState } from 'react'
import {
    getProjectFiles,
    runSimulation,
    getSimulationArtifacts,
    getWaveform,
} from '../services/projectApi'

export default function useProjectWorkspace(
    projectName,
    sessionControls
) {
    const [files, setFiles] = useState([])
    const [filesStatus, setFilesStatus] = useState('loading')

    const {
        simStatus,
        setSimStatus,
        setSimOutput,
        setArtifacts,
        setArtifactsStatus,
        setArtifactsError,
        setWaveform,
        setWaveformStatus,
        setWaveformError,
    } = sessionControls

    useEffect(() => {
        let isMounted = true

        setFilesStatus('loading')

        getProjectFiles(projectName)
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

        return () => {
            isMounted = false
        }
    }, [projectName])

    const fetchArtifacts = () => {
        setArtifactsStatus('loading')
        setArtifactsError('')

        getSimulationArtifacts(projectName)
            .then((data) => {
                setArtifacts(data.artifacts || [])
                setArtifactsStatus('loaded')
            })
            .catch((err) => {
                setArtifacts([])
                setArtifactsStatus('error')
                setArtifactsError(
                    err.message || 'Unable to load simulation artifacts.'
                )
            })
    }

    const fetchWaveform = () => {
        setWaveformStatus('loading')
        setWaveformError('')

        getWaveform(projectName)
            .then((data) => {
                setWaveform(data.waveform || null)
                setWaveformStatus('loaded')
            })
            .catch((err) => {
                setWaveform(null)
                setWaveformStatus('error')
                setWaveformError(
                    err.message || 'Unable to load waveform data.'
                )
            })
    }

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

        runSimulation(projectName)
            .then((data) => {
                if (data.status === 'success') {
                    setSimStatus('success')
                    setSimOutput(
                        data.output ||
                        'Simulation passed with no output.'
                    )

                    fetchArtifacts()
                    fetchWaveform()
                } else {
                    setSimStatus('failed')
                    setSimOutput(
                        data.output || 'Simulation failed.'
                    )
                }
            })
            .catch((err) => {
                setSimStatus('failed')
                setSimOutput(
                    err.message || 'Simulation execution failed.'
                )
            })
    }

    return {
        files,
        filesStatus,
        handleRunSimulation,
    }
}