const defaultSession = {
 simStatus: 'idle',
 simOutput: '',

 synthStatus: 'idle',
 synthOutput: '',
 synthMetrics: null,
 synthArtifacts: [],
 synthArtifactsStatus: 'idle',

 physicalStatus: 'idle',
 physicalOutput: '',
 physicalMetrics: null,
 physicalArtifacts: [],
 physicalArtifactsStatus: 'idle',

 artifacts: [],
 artifactsStatus: 'idle',
 artifactsError: '',

 waveform: null,
 waveformStatus: 'idle',
 waveformError: '',
}

export function createProjectSession() {
 return { ...defaultSession }
}

export default function useProjectSession(session, setSession) {
 const update = (key, value) => {
  setSession((previous) => ({
   ...previous,
   [key]:
    typeof value === 'function'
     ? value(previous[key])
     : value,
  }))
 }

 return {
  simStatus: session.simStatus,
  setSimStatus: (value) => update('simStatus', value),
  simOutput: session.simOutput,
  setSimOutput: (value) => update('simOutput', value),

  synthStatus: session.synthStatus,
  setSynthStatus: (value) => update('synthStatus', value),
  synthOutput: session.synthOutput,
  setSynthOutput: (value) => update('synthOutput', value),
  synthMetrics: session.synthMetrics,
  setSynthMetrics: (value) => update('synthMetrics', value),
  synthArtifacts: session.synthArtifacts,
  setSynthArtifacts: (value) => update('synthArtifacts', value),
  synthArtifactsStatus: session.synthArtifactsStatus,
  setSynthArtifactsStatus: (value) =>
   update('synthArtifactsStatus', value),

  physicalStatus: session.physicalStatus,
  setPhysicalStatus: (value) => update('physicalStatus', value),
  physicalOutput: session.physicalOutput,
  setPhysicalOutput: (value) => update('physicalOutput', value),
  physicalMetrics: session.physicalMetrics,
  setPhysicalMetrics: (value) => update('physicalMetrics', value),
  physicalArtifacts: session.physicalArtifacts,
  setPhysicalArtifacts: (value) =>
   update('physicalArtifacts', value),
  physicalArtifactsStatus: session.physicalArtifactsStatus,
  setPhysicalArtifactsStatus: (value) =>
   update('physicalArtifactsStatus', value),

  artifacts: session.artifacts,
  setArtifacts: (value) => update('artifacts', value),
  artifactsStatus: session.artifactsStatus,
  setArtifactsStatus: (value) =>
   update('artifactsStatus', value),
  artifactsError: session.artifactsError,
  setArtifactsError: (value) =>
   update('artifactsError', value),

  waveform: session.waveform,
  setWaveform: (value) => update('waveform', value),
  waveformStatus: session.waveformStatus,
  setWaveformStatus: (value) =>
   update('waveformStatus', value),
  waveformError: session.waveformError,
  setWaveformError: (value) =>
   update('waveformError', value),
 }
}