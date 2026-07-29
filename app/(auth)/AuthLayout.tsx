import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="grid min-h-screen grid-cols-1 bg-white min-[901px]:grid-cols-[minmax(480px,1.1fr)_minmax(420px,0.9fr)]">
      {/* Keep the form first in the DOM while placing it on the right at desktop widths. */}
      <section className="col-start-1 row-start-1 flex min-h-screen flex-col px-[22px] pt-6 pb-10 min-[521px]:px-[clamp(40px,7vw,104px)] min-[521px]:pt-10 min-[521px]:pb-16 min-[901px]:col-start-2">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>Room Booker</span>
        </Link>
        {children}
      </section>

      <aside
        className="col-start-1 row-start-1 hidden min-h-screen items-end bg-[#1e3027] p-[clamp(48px,7vw,104px)] text-white min-[901px]:flex"
        aria-label="Product overview"
      >
        <div className="max-w-[590px]">
          <p className="m-0 mb-3 text-xs font-[720] tracking-[0.11em] text-[#a9c7b6] uppercase">
            Shared time, clearly arranged
          </p>
          <h2 className="m-0 max-w-[560px] text-[clamp(38px,5vw,68px)] leading-[1.02] font-[570] tracking-[-0.055em]">
            Find the right room before the conversation starts.
          </h2>
          <p className="mt-6 mb-0 max-w-[500px] text-base leading-[1.65] text-[#c7d4cc]">
            One office schedule for every team in the company.
          </p>
        </div>
      </aside>
    </main>
  );
}
