import { useCallback, useEffect, useRef, useState } from "react";

interface TokenPreviewFrameProps {
  html: string;
  title: string;
  unavailableMessage: string;
  minHeight?: number;
}

export default function TokenPreviewFrame({
  html,
  title,
  unavailableMessage,
  minHeight = 260,
}: TokenPreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);
  const hasHtml = html.trim().length > 0;

  const resizeFrame = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;

    if (doc.documentElement) doc.documentElement.style.overflow = "hidden";
    if (doc.body) doc.body.style.overflow = "hidden";

    const nextHeight = Math.max(
      minHeight,
      Math.ceil(
        Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body?.scrollHeight ?? 0,
          doc.documentElement?.offsetHeight ?? 0,
          doc.body?.offsetHeight ?? 0,
        ),
      ),
    );
    setHeight((current) =>
      Math.abs(current - nextHeight) > 1 ? nextHeight : current,
    );
  }, [minHeight]);

  useEffect(() => {
    if (!hasHtml) {
      setHeight(minHeight);
      return undefined;
    }

    let observer: ResizeObserver | null = null;
    const timeoutIds: number[] = [];
    const animationFrame = window.requestAnimationFrame(() => {
      resizeFrame();

      const doc = frameRef.current?.contentDocument;
      if (!doc || !("ResizeObserver" in window)) return;

      observer = new ResizeObserver(resizeFrame);
      if (doc.documentElement) observer.observe(doc.documentElement);
      if (doc.body) observer.observe(doc.body);
    });

    for (const delay of [80, 250, 800]) {
      timeoutIds.push(window.setTimeout(resizeFrame, delay));
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      for (const timeoutId of timeoutIds) window.clearTimeout(timeoutId);
      observer?.disconnect();
    };
  }, [hasHtml, html, minHeight, resizeFrame]);

  if (!hasHtml) {
    return (
      <div
        className="flex items-center justify-center p-6 text-sm text-muted-foreground"
        style={{ minHeight }}
      >
        {unavailableMessage}
      </div>
    );
  }

  return (
    <iframe
      ref={frameRef}
      srcDoc={html}
      title={title}
      sandbox="allow-same-origin"
      scrolling="no"
      tabIndex={-1}
      onLoad={resizeFrame}
      className="pointer-events-none block w-full border-0"
      style={{ height }}
    />
  );
}
