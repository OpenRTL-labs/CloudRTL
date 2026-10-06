export default function WaveformDisplay({ waveform }) {
  const signals = waveform.signals || []

  const lastTime = Math.max(
    1,
    ...signals.flatMap((signal) =>
      (signal.changes || []).map((change) => change.time)
    )
  )

  // Add some space after the final transition so the last value is visible.
  const maxTime = Math.ceil(lastTime * 1.1)

  const waveformWidth = 1600
  const rowHeight = 56
  const labelWidth = 120
  const totalHeight = Math.max(80, signals.length * rowHeight)

  const getX = (time) => (time / maxTime) * waveformWidth

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
      <div className="min-w-[1750px] p-4">
        <div className="mb-3 flex items-center text-xs text-slate-500">
          <div
            className="flex-shrink-0"
            style={{ width: `${labelWidth}px` }}
          >
            Signal
          </div>

          <div className="relative h-6 flex-1">
            {Array.from({ length: 11 }, (_, index) => {
              const time = Math.round((maxTime / 10) * index)
              const position = index * 10

              return (
                <span
                  key={time}
                  className="absolute text-xs text-slate-500"
                  style={{
                    left: `${position}%`,
                    transform:
                      index === 0
                        ? 'translateX(0)'
                        : index === 10
                          ? 'translateX(-100%)'
                          : 'translateX(-50%)',
                  }}
                >
                  {time}
                </span>
              )
            })}
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
                  className="h-10 w-[1600px] flex-none"
                >
                  {changes.length > 0 &&
                    changes.map((change, index) => {
                      const nextChange = changes[index + 1]
                      const startX = getX(change.time)
                      const endX = nextChange
                        ? getX(nextChange.time)
                        : waveformWidth

                      const isVector = signal.width > 1

                      if (isVector) {
                        return (
                          <g key={`${signal.name}-${change.time}-${index}`}>
                            {/* Bus line */}
                            <line
                              x1={startX}
                              y1="20"
                              x2={endX}
                              y2="20"
                              stroke="currentColor"
                              strokeWidth="2"
                            />

                            {/* Transition */}
                            {index > 0 && (
                              <line
                                x1={startX}
                                y1="10"
                                x2={startX}
                                y2="30"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            )}

                            {/* Vector value */}
                            <text
                              x={(startX + endX) / 2}
                              y="24"
                              textAnchor="middle"
                              className="fill-slate-300"
                              fontSize="11"
                              fontFamily="monospace"
                            >
                              {change.value}
                            </text>
                          </g>
                        )
                      }

                      // Scalar signal
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