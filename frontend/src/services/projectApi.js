const AUTH_TOKEN_KEY = 'cloudrtl_access_token'

export function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function setAuthToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
}

async function apiFetch(url, options = {}) {
    const token = getAuthToken()

    const headers = new Headers(options.headers || {})

    if (token) {
        headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(url, {
        ...options,
        headers,
    })

    if (response.status === 401) {
        clearAuthToken()
        window.dispatchEvent(new Event('cloudrtl-auth-expired'))
    }

    return response
}

export async function login(username, password) {
    const response = await apiFetch('/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            password,
        }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
        throw new Error(
            data?.detail || `Login failed (${response.status})`
        )
    }

    setAuthToken(data.access_token)

    return data
}

export async function getCurrentUser() {
    const response = await apiFetch('/auth/me')

    const data = await response.json().catch(() => null)

    if (!response.ok) {
        throw new Error(
            data?.detail || `Authentication check failed (${response.status})`
        )
    }

    return data
}

export function logout() {
    clearAuthToken()
}

export async function getProjects() {
    const response = await apiFetch('/projects')

    const data = await response.json().catch(() => null)

    if (!response.ok) {
        throw new Error(
            data?.detail || `Failed to fetch projects (${response.status})`
        )
    }

    return data
}

export async function getProjectFiles(projectName) {
    const response = await apiFetch(`/projects/${projectName}/files`)

    if (!response.ok) {
        throw new Error('Failed to fetch project files')
    }

    const data = await response.json()

    if (data.detail) {
        throw new Error(data.detail)
    }

    return data
}

export async function getProjectFile(projectName, filename) {
    const response = await apiFetch(
        `/projects/${encodeURIComponent(projectName)}/files/${encodeURIComponent(filename)}`
    )

    if (!response.ok) {
        const error = await response.json().catch(() => null)

        throw new Error(
            error?.detail ||
            `Failed to fetch file (${response.status})`
        )
    }

    return response.json()
}

export async function runSimulation(projectName) {
    const response = await apiFetch(`/projects/${projectName}/simulate`, {
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
    const response = await apiFetch(`/projects/${projectName}/artifacts`)

    if (!response.ok) {
        throw new Error('Failed to fetch simulation artifacts')
    }

    return response.json()
}

export async function getWaveform(projectName) {
    const response = await apiFetch(`/projects/${projectName}/waveform`)

    if (!response.ok) {
        throw new Error('Failed to fetch waveform data')
    }

    return response.json()
}

export async function runSynthesis(projectName) {
    const response = await apiFetch(`/projects/${projectName}/synthesize`, {
        method: 'POST',
    })

    if (!response.ok) {
        throw new Error('Synthesis request failed')
    }

    return response.json()
}

export async function getSynthesisArtifacts(projectName) {
    const response = await apiFetch(
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
    const response = await apiFetch(
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

async function downloadAuthenticatedFile(url, filename) {
    const response = await apiFetch(url)

    if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(
            error?.detail || `Download failed (${response.status})`
        )
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

export function downloadSimulationArtifact(projectName, artifactName) {
    return downloadAuthenticatedFile(
        `/projects/${encodeURIComponent(projectName)}/artifacts/${encodeURIComponent(artifactName)}`,
        artifactName
    )
}

export function downloadSynthesisArtifact(projectName, artifactName) {
    return downloadAuthenticatedFile(
        `/projects/${encodeURIComponent(projectName)}/synthesis-artifacts/${encodeURIComponent(artifactName)}`,
        artifactName
    )
}

export function downloadPhysicalArtifact(projectName, artifactName) {
    return downloadAuthenticatedFile(
        `/projects/${encodeURIComponent(projectName)}/physical-artifacts/${encodeURIComponent(artifactName)}`,
        artifactName
    )
}

export async function createProject(projectData) {
    const response = await apiFetch('/projects', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(
            error?.detail || `Project creation failed (${response.status})`
        )
    }

    return response.json()
}

export async function addProjectFile(projectName, fileData) {
    const response = await apiFetch(`/projects/${projectName}/files`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(fileData),
    })

    if (!response.ok) {
        const error = await response.json().catch(() => null)
        throw new Error(
            error?.detail || `Failed to add file (${response.status})`
        )
    }

    return response.json()
}

export async function updateProjectFile(projectName, filename, content, type) {
    const response = await apiFetch(
        `/projects/${encodeURIComponent(projectName)}/files/${encodeURIComponent(filename)}`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: filename,
                type,
                content,
            }),
        }
    )

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        throw new Error(
            errorData.detail || `Failed to update file: ${response.status}`
        )
    }

    return response.json()
}