"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, Share, SquarePlus, MoreVertical } from "lucide-react";

/** The `beforeinstallprompt` event (not in the standard lib types). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Install app" option for the sidebar — lets the user add the console to their
 * phone home screen (PWA). Uses the native install prompt on Android/Chromium;
 * falls back to platform steps on iOS Safari and elsewhere. Hides itself once
 * the app is already running as an installed standalone app.
 */
export function InstallPwaButton() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Already installed → nothing to offer.
  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      try {
        await deferred.userChoice;
      } catch {
        /* no-op */
      }
      setDeferred(null);
    } else {
      setShowHelp(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-3 rounded-lg border border-accent/40 px-3 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
      >
        <Download className="h-[18px] w-[18px]" /> Install app
      </button>

      <Dialog open={showHelp} onOpenChange={(o) => !o && setShowHelp(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add 305 POS to your home screen</DialogTitle>
            <DialogDescription>
              Install the console so it opens full-screen, like a native app.
            </DialogDescription>
          </DialogHeader>
          {isIOS ? (
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="font-semibold">1.</span> Tap the{" "}
                <Share className="h-4 w-4" /> <span className="font-medium">Share</span> button in
                Safari’s toolbar.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">2.</span> Choose{" "}
                <SquarePlus className="h-4 w-4" />{" "}
                <span className="font-medium">Add to Home Screen</span>.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">3.</span> Tap{" "}
                <span className="font-medium">Add</span> — the 305 icon appears on your home screen.
              </li>
            </ol>
          ) : (
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="font-semibold">1.</span> Open your browser menu (
                <MoreVertical className="h-4 w-4" /> on Android Chrome, or the install icon in the
                desktop address bar).
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">2.</span> Choose{" "}
                <span className="font-medium">Install app</span> /{" "}
                <span className="font-medium">Add to Home screen</span>.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">3.</span> Confirm — the 305 icon is added to your
                device.
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
