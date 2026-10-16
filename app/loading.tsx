import { Loader } from "@/components/ui/loader";

/** Full-screen loader for the initial app load / top-level route transitions. */
export default function Loading() {
  return <Loader className="min-h-screen" label="Loading…" />;
}
