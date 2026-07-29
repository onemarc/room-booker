import AuthLayout from "./AuthLayout";

// Next.js requires layout.tsx for route discovery; the named component owns the UI.
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AuthLayout>{children}</AuthLayout>;
}
