import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { marked } from "marked";
import mermaid from "mermaid";
import "./docs.css";

// ============================================
// DOCS INDEX
// ============================================

const DOCS: ReadonlyArray<{ readonly slug: string; readonly title: string }> = [
  { slug: "game-specification", title: "Game Specification" },
  { slug: "map-engine", title: "Map Engine" },
  { slug: "architecture", title: "Architecture" },
  { slug: "cli", title: "CLI Reference" },
  { slug: "api", title: "API Reference" },
  { slug: "development", title: "Development Guide" },
  { slug: "v1-plan", title: "Road to Playable v1" },
];

// ============================================
// MARKDOWN RENDERING
// ============================================

const renderMarkdown = (source: string): string => {
  const renderer = new marked.Renderer();

  // Convert doc links: [text](cli.md) → [text](/docs/cli)
  renderer.link = ({ href, text }) => {
    const docMatch = href.match(/^([a-z-]+)\.md$/);
    if (docMatch !== null) {
      return `<a href="/docs/${docMatch[1]}">${text}</a>`;
    }
    return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  };

  return marked.parse(source, { renderer, async: false }) as string;
};

const initMermaid = (): void => {
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      primaryColor: "#2a5a3c",
      primaryTextColor: "#eee",
      lineColor: "#888",
      secondaryColor: "#333",
      tertiaryColor: "#222",
    },
  });
};

const renderMermaidDiagrams = async (): Promise<void> => {
  const elements = document.querySelectorAll<HTMLElement>("code.language-mermaid");
  const renderPromises = Array.from(elements).map(async (codeElement, index) => {
    const container = codeElement.parentElement;
    if (container === null) return;

    const diagramSource = codeElement.textContent ?? "";
    const diagramId = `mermaid-${index}`;

    try {
      const { svg } = await mermaid.render(diagramId, diagramSource);
      const wrapper = document.createElement("div");
      wrapper.className = "mermaid-diagram";
      wrapper.innerHTML = svg;
      container.replaceWith(wrapper);
    } catch (error) {
      console.error("Mermaid render error:", error);
    }
  });

  await Promise.all(renderPromises);
};

// ============================================
// COMPONENT
// ============================================

export const DocsPage = () => {
  const { topic } = useParams<{ topic: string }>();
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isIndex = topic === undefined;

  const loadDoc = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fileName = isIndex ? "index" : topic;
    try {
      const response = await fetch(`/docs/${fileName}.md`);
      if (!response.ok) {
        setError(`Document not found: ${fileName}.md`);
        setLoading(false);
        return;
      }
      const markdown = await response.text();
      const html = renderMarkdown(markdown);
      setContent(html);
    } catch (fetchError) {
      setError("Failed to load document");
    }
    setLoading(false);
  }, [topic, isIndex]);

  useEffect(() => {
    initMermaid();
  }, []);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  // Render mermaid diagrams after content is set
  useEffect(() => {
    if (content !== "") {
      renderMermaidDiagrams();
    }
  }, [content]);

  return (
    <div className="docs-page">
      <nav className="docs-nav">
        <Link to="/docs" className="docs-nav-title">
          Docs
        </Link>
        {DOCS.map((doc) => (
          <Link
            key={doc.slug}
            to={`/docs/${doc.slug}`}
            className={`docs-nav-link ${topic === doc.slug ? "docs-nav-link-active" : ""}`}
          >
            {doc.title}
          </Link>
        ))}
        <div className="docs-nav-divider" />
        <Link to="/" className="docs-nav-link docs-nav-link-back">
          Back to Game
        </Link>
      </nav>

      <main className="docs-content">
        {loading && <div className="docs-loading">Loading...</div>}
        {error !== null && <div className="docs-error">{error}</div>}
        {!loading && error === null && (
          <article
            className="docs-article"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </main>
    </div>
  );
};
