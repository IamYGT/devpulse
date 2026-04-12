import ReactMarkdown from "react-markdown";

// ── Types ────────────────────────────────────────────────────
interface NotePreviewProps {
  content: string;
}

// ── Main component ───────────────────────────────────────────
export default function NotePreview({ content }: NotePreviewProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 400,
        padding: "16px 20px",
        overflowY: "auto",
        background: "var(--bg-primary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        fontFamily: "'Inter', sans-serif",
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--text-primary)",
      }}
    >
      {content.trim() ? (
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  margin: "0 0 12px",
                  paddingBottom: 8,
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  margin: "20px 0 8px",
                  color: "var(--text-primary)",
                }}
              >
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  margin: "16px 0 6px",
                  color: "var(--text-primary)",
                }}
              >
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p style={{ margin: "0 0 12px", color: "var(--text-primary)" }}>
                {children}
              </p>
            ),
            strong: ({ children }) => (
              <strong style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em style={{ fontStyle: "italic", color: "var(--text-secondary)" }}>
                {children}
              </em>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--accent-blue)",
                  textDecoration: "none",
                  borderBottom: "1px solid transparent",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderBottomColor = "var(--accent-blue)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderBottomColor = "transparent";
                }}
              >
                {children}
              </a>
            ),
            code: ({ children, className }) => {
              const isBlock = className?.startsWith("language-");
              if (isBlock) {
                return (
                  <code
                    style={{
                      display: "block",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: "var(--text-primary)",
                    }}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    padding: "2px 6px",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    color: "var(--accent-purple)",
                  }}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre
                style={{
                  margin: "12px 0",
                  padding: "14px 16px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  overflowX: "auto",
                }}
              >
                {children}
              </pre>
            ),
            ul: ({ children }) => (
              <ul
                style={{
                  margin: "8px 0",
                  paddingLeft: 24,
                  listStyleType: "disc",
                }}
              >
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol
                style={{
                  margin: "8px 0",
                  paddingLeft: 24,
                  listStyleType: "decimal",
                }}
              >
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li style={{ margin: "4px 0", color: "var(--text-primary)" }}>
                {children}
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote
                style={{
                  margin: "12px 0",
                  padding: "8px 16px",
                  borderLeft: "3px solid var(--accent-blue)",
                  background: "var(--bg-secondary)",
                  borderRadius: "0 var(--radius) var(--radius) 0",
                  color: "var(--text-secondary)",
                }}
              >
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div style={{ overflowX: "auto", margin: "12px 0" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead style={{ background: "var(--bg-card)" }}>{children}</thead>
            ),
            th: ({ children }) => (
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {children}
              </td>
            ),
            hr: () => (
              <hr
                style={{
                  margin: "20px 0",
                  border: "none",
                  borderTop: "1px solid var(--border)",
                }}
              />
            ),
            input: ({ type, checked, ...rest }) => {
              if (type === "checkbox") {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    style={{
                      marginRight: 6,
                      accentColor: "var(--accent-blue)",
                      cursor: "default",
                    }}
                    {...rest}
                  />
                );
              }
              return <input type={type} checked={checked} {...rest} />;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--text-muted)",
            fontSize: 13,
            fontStyle: "italic",
          }}
        >
          Onizleme icin icerik yazin...
        </div>
      )}
    </div>
  );
}
