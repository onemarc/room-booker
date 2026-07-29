import Login from "./Login";

export const metadata = {
  title: "Sign in",
};

// Keep this required route file thin; the screen implementation lives in Login.tsx.
export default function LoginPage() {
  return <Login />;
}
