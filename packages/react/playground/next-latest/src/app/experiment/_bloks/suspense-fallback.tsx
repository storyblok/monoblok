// REAL — default Suspense fallback registered on the resolver. Shows briefly
// while async-server-fetch resolves (especially noticeable on the client
// preview path).
export function SuspenseFallback() {
  return (
    <div style={{ padding: 8, color: '#6b7280', fontStyle: 'italic' }}>
      Loading async blok…
    </div>
  );
}
