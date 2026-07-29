import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/server/session";

export default async function Login() {
  if (await getCurrentUser()) {
    redirect("/calendar");
  }

  return (
    <div className="my-auto w-full max-w-[430px] py-[52px] pb-[30px] min-[521px]:py-[72px]">
      <div className="mb-[34px]">
        <p className="m-0 mb-3 text-xs font-[720] tracking-[0.11em] text-[#255b43] uppercase">
          Welcome back
        </p>
        <h1 className="m-0 text-[clamp(31px,4vw,42px)] leading-[1.08] font-[650] tracking-[-0.045em] text-[#17201b]">
          Sign in to your workspace
        </h1>
        <p className="mt-3.5 mb-0 text-[15px] leading-[1.65] text-[#667069]">
          Use your employee account to view room schedules.
        </p>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
