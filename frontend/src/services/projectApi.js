export async function getProjectFiles(projectName) {
    const response = await fetch(`/projects/${projectName}/files`)

    if (!response.ok) {
        throw new Error('Failed to fetch project files')
    }

    const data = await response.json()

    if (data.detail) {
        throw new Error(data.detail)
    }

    return data
}

export async function runSimulation(projectName) {
    const response = await fetch(`/projects/${projectName}/simulate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => null)

        throw new Error(
            error?.detail ||
            `Simulation request failed (${response.status})`
        )
    }

    return response.json()
}

export async function getSimulationArtifacts(projectName) {
    const response = await fetch(`/projects/${projectName}/artifacts`)

    if (!response.ok) {
        throw new Error('Failed to fetch simulation artifacts')
    }

    return response.json()
}

export async function getWaveform(projectName) {
    const response = await fetch(`/projects/${projectName}/waveform`)

    if (!response.ok) {
        throw new Error('Failed to fetch waveform data')
    }

    return response.json()
}

export async function runSynthesis(projectName) {
    const response = await fetch(`/projects/${projectName}/synthesize`, {
        method: 'POST',
    })

    if (!response.ok) {
        throw new Error('Synthesis request failed')
    }

    return response.json()
}

export async function getSynthesisArtifacts(projectName) {
    const response = await fetch(
        `/projects/${projectName}/synthesis-artifacts`
    )

    if (!response.ok) {
        throw new Error(
            `Failed to load synthesis artifacts (${response.status})`
        )
    }

    return response.json()
}

export async function runPhysicalDesign(projectName) {
    const response = await fetch(
        `/projects/${projectName}/physical-design`,
        {
            method: 'POST',
        }
    )

    if (!response.ok) {
        const error = await response.json().catch(() => null)

        throw new Error(
            error?.detail ||
            `Physical design request failed (${response.status})`
        )
    }

    return response.json()
}