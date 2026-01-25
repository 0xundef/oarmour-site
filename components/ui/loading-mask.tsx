
import { Icons } from "@/components/icons";

export function LoadingMask() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/50 backdrop-blur-sm">
      <Icons.spinner className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
