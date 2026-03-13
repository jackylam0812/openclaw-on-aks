import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[70%] bg-gradient-to-br from-purple-600/80 to-blue-600/80 rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-white whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs text-white font-bold shrink-0">
        O
      </div>
      <div className="max-w-[70%] bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="prose-dark text-sm">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
