import { SkeletonBlock } from "@/components/ui/AsyncState";

export default function CalendarLoading() {
  return (
    <main
      className="flex h-screen min-h-[560px] w-full overflow-hidden bg-[var(--surface)] supports-[height:100dvh]:h-dvh"
      role="status"
      aria-label="Loading calendar"
    >
      <span className="sr-only">Loading calendar</span>
      <aside className="flex w-[clamp(260px,23vw,304px)] min-w-[260px] flex-none flex-col overflow-hidden border-r border-[var(--line)] bg-[#f8faf8] max-[1060px]:w-[250px] max-[1060px]:min-w-[250px] max-[760px]:w-[clamp(220px,38vw,250px)] max-[760px]:min-w-[clamp(220px,38vw,250px)]">
        <div className="flex min-h-[58px] items-center gap-3 border-b border-[var(--line)] px-3.5">
          <SkeletonBlock className="size-8" />
          <SkeletonBlock className="h-5 w-28" />
        </div>
        <div className="grid gap-3 border-b border-[var(--line)] p-4">
          <SkeletonBlock className="h-5 w-36" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, index) => (
              <SkeletonBlock className="aspect-square rounded-md" key={index} />
            ))}
          </div>
        </div>
        <div className="grid gap-2.5 p-4">
          <SkeletonBlock className="mb-1 h-5 w-24" />
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock className="h-[70px] w-full" key={index} />
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-[58px] items-center justify-between gap-4 border-b border-[var(--line)] px-3.5 max-[1060px]:min-h-[98px]">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-8 w-[min(430px,58%)]" />
        </div>
        <div className="flex min-h-[55px] items-center justify-between gap-4 border-b border-[var(--line)] px-3.5">
          <SkeletonBlock className="h-8 w-36" />
          <SkeletonBlock className="h-9 w-24 bg-[#dfe9e3]" />
        </div>
        <div className="grid min-h-[52px] grid-cols-[62px_repeat(7,minmax(94px,1fr))] border-b border-[var(--grid-line)]">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              className="grid place-items-center border-r border-[var(--grid-line)]"
              key={index}
            >
              {index > 0 ? <SkeletonBlock className="h-4 w-10" /> : null}
            </div>
          ))}
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_27px,var(--grid-line)_28px)]">
          <div className="absolute inset-[26px_28px_26px_82px] grid content-start gap-5">
            <SkeletonBlock className="h-14 w-[24%]" />
            <SkeletonBlock className="ml-[42%] h-20 w-[22%]" />
            <SkeletonBlock className="ml-[12%] h-12 w-[20%]" />
          </div>
        </div>
      </section>
    </main>
  );
}
