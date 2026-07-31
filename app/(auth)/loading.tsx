import { SkeletonBlock } from "@/components/ui/AsyncState";

export default function AuthLoading() {
  return (
    <div
      className="my-auto grid w-full max-w-[430px] gap-5 py-[52px] pb-[30px] min-[521px]:py-[72px]"
      role="status"
      aria-label="Restoring your session"
    >
      <span className="sr-only">Restoring your session</span>
      <SkeletonBlock className="h-3 w-28" />
      <SkeletonBlock className="h-11 w-[82%]" />
      <SkeletonBlock className="mb-4 h-5 w-[68%]" />
      <SkeletonBlock className="h-12 w-full" />
      <SkeletonBlock className="h-12 w-full" />
      <SkeletonBlock className="h-12 w-full bg-[#dfe9e3]" />
    </div>
  );
}
