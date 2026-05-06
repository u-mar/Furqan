'use client'

import type { WordResult } from '@/types'

interface DiffDisplayProps {
  results: WordResult[]
}

export default function DiffDisplay({ results }: DiffDisplayProps) {
  const getWordClass = (op: WordResult['op']) => {
    switch (op) {
      case 'match':
        return 'text-emerald-600'
      case 'substitution':
        return 'text-red-600'
      case 'deletion':
        return 'text-red-600 underline decoration-red-300'
      case 'insertion':
        return 'text-gray-400 line-through'
      default:
        return ''
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Word-by-Word Comparison</h3>

      <div className="arabic-text space-y-2">
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Your recitation:</p>
          <div className="flex flex-wrap gap-1">
            {results.map((result, index) => (
              <span
                key={index}
                className={`${getWordClass(result.op)} px-1`}
                title={result.op === 'substitution' ? `Should be: ${result.canonical}` : ''}
              >
                {result.hypothesis || result.canonical}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-2">Correct text:</p>
          <div className="flex flex-wrap gap-1">
            {results.map((result, index) => (
              <span
                key={index}
                className="text-gray-700 px-1"
              >
                {result.canonical}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-emerald-500 rounded"></span>
            <span className="text-gray-600">Correct</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded"></span>
            <span className="text-gray-600">Wrong</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-400 rounded"></span>
            <span className="text-gray-600">Extra</span>
          </span>
        </div>
      </div>
    </div>
  )
}
