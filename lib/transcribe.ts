export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const arrayBuffer = await audioBlob.arrayBuffer()

  const response = await fetch(
    'https://api-inference.huggingface.co/models/tarteel-ai/whisper-base-ar-quran',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: arrayBuffer,
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace API error: ${err}`)
  }

  const data = await response.json()
  return data.text as string
}

export async function transcribeWithRetry(audioBlob: Blob, maxRetries = 3): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await transcribeAudio(audioBlob)
    } catch (error) {
      const err = error as Error
      if (err.message.includes('loading') && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 20000))
      } else {
        throw error
      }
    }
  }
  throw new Error('Failed to transcribe after maximum retries')
}
