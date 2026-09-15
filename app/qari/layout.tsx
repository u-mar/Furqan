/**
 * Qari is neutral in the light theme — white cards on grey. The screens set
 * that class on <html> once they mount; this sets it before the first paint
 * too, so opening a Qari link directly never flashes the cream theme.
 */
export default function QariLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('qari-neutral')" }}
      />
      {children}
    </>
  )
}
