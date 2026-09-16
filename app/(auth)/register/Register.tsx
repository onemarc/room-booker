import Image from "next/image";
import favicon from "@/app/favicon.ico";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/lib/server/session";

export default async function Register() {
  if (await getCurrentUser()) {
    redirect("/calendar");
  }

  return (
    <div className="my-auto w-full max-w-[430px] py-[52px] pb-[30px] min-[521px]:py-[72px]">
      <div className="mb-[34px]">
        {/* Brand identity header with official favicon mark, static without navigational link */}
        <div className="mb-6 flex items-center gap-[11px] text-[15px] font-[690] tracking-[-0.015em] text-[var(--ink)]">
          <Image
            src={favicon}
            alt="Room Booker logo"
            width={30}
            height={30}
            className="size-[30px] rounded-[9px]"
            priority
          />
          <span>Room Booker</span>
        </div>
        <p className="m-0 mb-3 text-xs font-[720] tracking-[0.11em] text-[#255b43] uppercase">
          Employee access
        </p>
        <h1 className="m-0 text-[clamp(31px,4vw,42px)] leading-[1.08] font-[650] tracking-[-0.045em] text-[#17201b]">
          Create your account
        </h1>
        <p className="mt-3.5 mb-0 text-[15px] leading-[1.65] text-[#667069]">
          Your name will identify the bookings you make.
        </p>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
