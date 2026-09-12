export default function WaveformDisplay({ waveform }) {
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