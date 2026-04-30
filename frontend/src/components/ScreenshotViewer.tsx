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

  if (loading) return <div style={{ color: "#999", padding: 12 }}>Loading...</div>;
  if (screenshots.length === 0) return <div style={{ color: "#999", padding: 12 }}>No screenshots.</div>;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {screenshots.map((s) => {
          const url = getAttachmentUrl(s.id);
          return (
            <div
              key={s.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 4,
                padding: 4,
                cursor: "pointer",
              }}
              onClick={() => setSelectedImage(url)}
            >
              <img
                src={url}
                alt={s.file_name}
                style={{ width: 160, height: 100, objectFit: "cover", borderRadius: 2 }}
              />
              <div style={{ fontSize: 11, color: "#666", marginTop: 4, textAlign: "center" }}>
                {s.file_name}
              </div>
            </div>
          );
        })}
      </div>

      {selectedImage && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            cursor: "pointer",
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Full size"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 4 }}
          />
        </div>
      )}
    </div>
  );
};
