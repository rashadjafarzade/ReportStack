import React, { useEffect, useState } from "react";
import { getTestAttachments, getAttachmentUrl } from "../api/attachments";
import { Attachment } from "../types";

interface ScreenshotViewerProps {
  launchId: number;
  itemId: number;
}

export const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({ launchId, itemId }) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTestAttachments(launchId, itemId)
      .then((res) => setAttachments(res.data))
      .finally(() => setLoading(false));
  }, [launchId, itemId]);

  const screenshots = attachments.filter((a) => a.attachment_type === "SCREENSHOT");

  if (loading) {
    return (
      <div className="loading-center" style={{ padding: "var(--space-6)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (screenshots.length === 0) {
    return (
      <div className="empty-state" style={{ padding: "var(--space-8)" }}>
        <div className="empty-state-icon">&#128247;</div>
        <div className="empty-state-title">No Screenshots</div>
        <div className="empty-state-description">
          Screenshots captured during test execution will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="screenshot-grid">
        {screenshots.map((s) => {
          const url = getAttachmentUrl(s.id);
          return (
            <div
              key={s.id}
              className="screenshot-thumb"
              onClick={() => setSelectedImage(url)}
            >
              <img src={url} alt={s.file_name} />
              <div className="screenshot-thumb-label">{s.file_name}</div>
            </div>
          );
        })}
      </div>

      {selectedImage && (
        <div className="lightbox-overlay" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Full size" />
        </div>
      )}
    </div>
  );
};
