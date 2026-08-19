// Shared between app/page.tsx and app/dashboard/page.tsx — was previously
// defined separately (identically) in both.
export default function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline-strong border-t-accent" />;
}
