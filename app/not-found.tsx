import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl font-semibold tracking-tight">404</div>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/dashboard">
        <Button variant="accent">Back to dashboard</Button>
      </Link>
    </div>
  );
}
