import React, { useEffect, useState } from "react";
import { getItemComments, createItemComment, deleteComment } from "../api/comments";
import { Comment } from "../types";
import { format } from "date-fns";

interface CommentSectionProps {
  launchId: number;
  itemId: number;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ launchId, itemId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("QA Engineer");
  const [submitting, setSubmitting] = useState(false);

  const loadComments = () => {
    setLoading(true);
    getItemComments(launchId, itemId)
      .then((res) => setComments(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadComments();
  }, [launchId, itemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    createItemComment(launchId, itemId, { author, text: text.trim() })
      .then(() => {
        setText("");
        loadComments();
      })
      .finally(() => setSubmitting(false));
  };

  const handleDelete = (id: number) => {
    deleteComment(id).then(() => loadComments());
  };

  return (
    <div className="comment-section">
      <form className="comment-form" onSubmit={handleSubmit}>
        <div className="comment-form-row">
          <input
            className="input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name"
            style={{ maxWidth: 160 }}
          />
          <textarea
            className="input comment-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={submitting || !text.trim()}>
            {submitting ? "..." : "Post"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="loading-center" style={{ padding: "var(--space-6)" }}>
          <div className="spinner" />
        </div>
      ) : comments.length === 0 ? (
        <div className="comment-empty">No comments yet</div>
      ) : (
        <div className="comment-list">
          {comments.map((c) => (
            <div key={c.id} className="comment-item">
              <div className="comment-header">
                <div className="comment-author-row">
                  <span className="comment-avatar">{c.author.charAt(0).toUpperCase()}</span>
                  <span className="comment-author">{c.author}</span>
                  <span className="comment-time">
                    {format(new Date(c.created_at), "MMM d, yyyy HH:mm")}
                  </span>
                </div>
                <button className="btn btn-ghost btn-sm comment-delete" onClick={() => handleDelete(c.id)} title="Delete">
                  &times;
                </button>
              </div>
              <div className="comment-text">{c.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
