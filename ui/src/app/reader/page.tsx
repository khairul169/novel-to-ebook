import React, { useEffect, useRef, useState } from "react";
import type { BookDoc, FoliateView } from "./lib/types.js";

type ReaderStyles = {
  spacing: number;
  justify: boolean;
  hyphenate: boolean;
  fontSize?: number;
  minFontSize?: number;
  fontWeight?: number | string;
};

const getCSS = ({
  spacing,
  justify,
  hyphenate,
  fontSize = 16,
  minFontSize = 8,
  fontWeight = 400,
}: ReaderStyles) => `
    @namespace epub "http://www.idpf.org/2007/ops";
    html {
        color-scheme: light dark;
        background: #222;
    }
    html, body {
      font-size: ${fontSize}px !important;
      font-weight: ${fontWeight};
      font-family: Arial, sans-serif;
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
      color: white;
    }
    a:link {
      color: lightblue;
    }
    font[size="1"] {
      font-size: ${minFontSize}px;
    }
    font[size="2"] {
      font-size: ${minFontSize * 1.5}px;
    }
    font[size="3"] {
      font-size: ${fontSize}px;
    }
    font[size="4"] {
      font-size: ${fontSize * 1.2}px;
    }
    font[size="5"] {
      font-size: ${fontSize * 1.5}px;
    }
    font[size="6"] {
      font-size: ${fontSize * 2}px;
    }
    font[size="7"] {
      font-size: ${fontSize * 3}px;
    }
    p, li, blockquote, dd {
        line-height: ${spacing};
        text-align: ${justify ? "justify" : "start"};
        -webkit-hyphens: ${hyphenate ? "auto" : "manual"};
        hyphens: ${hyphenate ? "auto" : "manual"};
        -webkit-hyphenate-limit-before: 3;
        -webkit-hyphenate-limit-after: 2;
        -webkit-hyphenate-limit-lines: 2;
        hanging-punctuation: allow-end last;
        widows: 2;
    }
    /* prevent the above from overriding the align attribute */
    [align="left"] { text-align: left; }
    [align="right"] { text-align: right; }
    [align="center"] { text-align: center; }
    [align="justify"] { text-align: justify; }

    pre {
        white-space: pre-wrap !important;
    }
    aside[epub|type~="endnote"],
    aside[epub|type~="footnote"],
    aside[epub|type~="note"],
    aside[epub|type~="rearnote"] {
        display: none;
    }
`;

export default function ReaderPage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const viewRef = useRef<FoliateView | null>(null);
  const [_cover, setCover] = useState<string | null>(null);

  const onKeyDown = (event: KeyboardEvent) => {
    if (!viewRef.current) return;

    const k = event.key;
    if (k === "ArrowLeft" || k === "h") viewRef.current.goLeft();
    else if (k === "ArrowRight" || k === "l") viewRef.current.goRight();
  };

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const openDoc = async (file: File) => {
    if (viewRef.current) {
      viewRef.current.close();
      containerRef.current!.removeChild(viewRef.current);
      viewRef.current = null;
    } else {
      // @ts-ignore
      await import("@/lib/foliate-js/view.js");
    }

    const view = document.createElement("foliate-view") as FoliateView;
    view.style.width = "100%";
    view.style.height = "100vh";
    view.style.display = "block";
    viewRef.current = view;

    containerRef.current.innerHTML = "";
    containerRef.current.append(view);
    // document.body.append(view);
    await view.open(file as unknown as BookDoc);
    view.addEventListener("load", (ev) => {
      const doc = (ev as any).detail.doc as HTMLElement;
      doc.addEventListener("keydown", onKeyDown);
    });
    view.addEventListener("relocate", (e: any) => {
      console.log(e.detail);
    });

    console.log(view.book);
    const { book } = view;
    console.log(book.metadata.title);
    // book.transformTarget?.addEventListener("data", ({ detail }) => {
    //   detail.data = Promise.resolve(detail.data).catch((e) => {
    //     console.error(new Error(`Failed to load ${detail.name}`, { cause: e }));
    //     return "";
    //   });
    // });
    view.renderer.setStyles?.(
      getCSS({
        spacing: 1.5,
        justify: true,
        hyphenate: true,
        fontSize: 16,
      }),
    );

    Promise.resolve(book.getCover?.())?.then((blob) => {
      setCover(blob ? URL.createObjectURL(blob) : null);
    });

    const toc = book.toc;
    if (toc) {
      console.log("toc", toc);
    }

    // enable pagination
    view.renderer.setAttribute("flow", "paginated");
    view.renderer.setAttribute("gap", "1%");
    view.renderer.setAttribute("max-inline-size", "720px");

    // enable animation
    view.renderer.setAttribute("animated", "true");

    view.renderer.next();
  };

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement, HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) openDoc(file);
  };

  return (
    <div ref={containerRef}>
      <input type="file" onChange={onChange} />
    </div>
  );
}
