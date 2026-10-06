import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ai-markdown.css";

export default function AiMarkdown({ text }: { text: string }) {
  return (
    <div className="ai-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
          img: ({ alt }) => <span>{alt || ""}</span>,
          table: ({ children }) => <div className="ai-markdown-table"><table>{children}</table></div>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
