'use client'

interface ScoreCardProps {
  score: number
  correctWords: number
  totalWords: number
  onRetry: () => void
  onNextAyah: () => void
  onGoHome: () => void
}

export default function ScoreCard({
  score,
  correctWords,
  totalWords,
  onRetry,
  onNextAyah,
  onGoHome,
}: ScoreCardProps) {
  const getScoreColor = () => {
    if (score >= 90) return 'text-emerald-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreMessage = () => {
    if (score >= 90) return 'Excellent!'
    if (score >= 70) return 'Good effort!'
    if (score >= 50) return 'Keep practicing!'
    return 'Needs more work'
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center">
        <div className={`text-6xl font-bold mb-2 ${getScoreColor()}`}>
          {score}%
        </div>
        <p className="text-xl text-gray-700 mb-4">{getScoreMessage()}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-emerald-600">{correctWords}</div>
            <div className="text-sm text-gray-600">Correct words</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-600">{totalWords}</div>
            <div className="text-sm text-gray-600">Total words</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onRetry}
            className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Try Again
          </button>
          <button
            onClick={onNextAyah}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Continue
          </button>
          <button
            onClick={onGoHome}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  )
}
