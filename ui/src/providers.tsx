import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "./components/ui/tooltip";

export default function Providers({ children }: React.ComponentProps<"div">) {
  return (
    <>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </TooltipProvider>
      <Toaster />
    </>
  );
}
