import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { queryClient } from "./lib/queryClient";

export default function Providers({ children }: React.ComponentProps<"div">) {
  return (
    <>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster />
    </>
  );
}
