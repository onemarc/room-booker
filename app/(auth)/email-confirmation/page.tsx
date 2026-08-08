import Link from "next/link";

export const metadata = {
  title: "Email activation",
};

type EmailConfirmationPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function EmailConfirmationPage({
  searchParams,
}: EmailConfirmationPageProps) {
  const { status } = await searchParams;
  const isSuccess = status === "success";

  return (
    <div className="my-auto w-full max-w-[430px] py-[52px] pb-[30px] min-[521px]:py-[72px]">
      <p className="m-0 mb-3 text-xs font-[720] tracking-[0.11em] text-[#255b43] uppercase">
        Email activation
      </p>
      <h1 className="m-0 text-[clamp(31px,4vw,42px)] leading-[1.08] font-[650] tracking-[-0.045em] text-[#17201b]">
        {isSuccess ? "Your email is active" : "Activation link failed"}
      </h1>
      <p
        className={`mt-3.5 mb-0 border-l-[3px] py-0.5 pl-[11px] text-[13px] leading-[1.5] ${
          isSuccess
            ? "border-[#6f9e7d] text-[#356047]"
            : "border-[#c75a5a] text-[#a13838]"
        }`}
        role={isSuccess ? "status" : "alert"}
      >
        {isSuccess
          ? "Your email was activated successfully. You can now create room bookings."
          : "This activation link is invalid or expired. Sign in to request a new activation link."}
      </p>
      <Link
        className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-[9px] bg-[#255b43] text-sm font-[660] !text-white no-underline transition-[background-color,transform] duration-150 hover:bg-[#1d4a36] active:translate-y-px"
        href={isSuccess ? "/calendar" : "/login"}
      >
        {isSuccess ? "Open calendar" : "Back to sign in"}
      </Link>
    </div>
  );
}
