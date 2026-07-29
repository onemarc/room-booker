import Register from "./Register";

export const metadata = {
  title: "Create account",
};

// Keep this required route file thin; the screen implementation lives in Register.tsx.
export default function RegisterPage() {
  return <Register />;
}
