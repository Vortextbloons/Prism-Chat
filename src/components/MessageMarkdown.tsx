import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type MessageMarkdownProps = {
  content: string
}

export function MessageMarkdown({ content }: MessageMarkdownProps) {
  return (
    <div className="message-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
        pre: ({ children }) => <pre className="md-pre">{children}</pre>,
        code: ({ className, children, ...props }) => {
          const isBlock = Boolean(className)
          if (isBlock) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          }
          return (
            <code className="md-inline-code" {...props}>
              {children}
            </code>
          )
        },
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
