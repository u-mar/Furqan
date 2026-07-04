import ImitateScreen from '@/components/imitate/ImitateScreen'
import ImitateAccessGuard from '@/components/imitate/ImitateAccessGuard'

export default function ImitatePage() {
  return (
    <ImitateAccessGuard>
      <ImitateScreen />
    </ImitateAccessGuard>
  )
}
