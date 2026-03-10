export type ReaderTheme = {
  background?: string;
  color?: string;
  linkColor?: string;
};
export type ReaderStyles = {
  spacing: number;
  justify: boolean;
  hyphenate: boolean;
  padding?: string;
  fontFamily?: string;
  fontSize?: number;
  minFontSize?: number;
  fontWeight?: number | string;
  theme?: { dark: ReaderTheme; light: ReaderTheme };
  colorScheme?: "dark" | "light";
};

export function getCSS({
  spacing,
  justify,
  hyphenate,
  padding = "0 0.5rem",
  fontFamily = "'Bitter', serif",
  fontSize = 16,
  minFontSize = 8,
  fontWeight = 400,
  theme,
  colorScheme = "dark",
}: ReaderStyles) {
  return `
    @namespace epub "http://www.idpf.org/2007/ops";
    @import url('https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,100..900;1,100..900&display=swap');
    html {
        color-scheme: light dark;
    }
    html, body {
      padding: ${padding};
      font-size: ${fontSize}px !important;
      font-weight: ${fontWeight};
      font-family: ${fontFamily} !important;
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
      background: ${theme?.[colorScheme]?.background || "#222"}; 
      color: ${theme?.[colorScheme]?.color || "#fff"};
    }
    a:link {
      color: ${theme?.[colorScheme]?.linkColor || "lightblue"};
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
}

const additionalFonts = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "true",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,100..900;1,100..900&display=swap",
  },
];

export function injectAdditionalLinks(doc: Document) {
  additionalFonts.forEach((link) => {
    const child = doc.createElement("link");
    child.rel = link.rel;
    child.href = link.href;
    child.crossOrigin = link.crossOrigin || "";
    doc.head.appendChild(child);
  });
}
