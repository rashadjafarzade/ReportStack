import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLaunches } from "../api/launches";
import { Launch } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { StatsBar } from "../components/StatsBar";
import { format } from "date-fns";

const LaunchList: React.FC = () => {
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    getLaunches(page, pageSize).then((res) => {
      setLaunches(res.data.items);
      setTotal(res.data.total);
    });
  }, [page]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Launches</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #eee", textAlign: "left" }}>
            <th style={{ padding: "8px 12px" }}>#</th>
            <th style={{ padding: "8px 12px" }}>Name</th>
            <th style={{ padding: "8px 12px" }}>Status</th>
            <th style={{ padding: "8px 12px" }}>Started</th>
            <th style={{ padding: "8px 12px", minWidth: 200 }}>Results</th>
            <th style={{ padding: "8px 12px" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {launches.map((launch) => (
            <tr key={launch.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "10px 12px" }}>{launch.id}</td>
              <td style={{ padding: "10px 12px" }}>
                <Link to={`/launches/${launch.id}`} style={{ color: "#1976d2", textDecoration: "none" }}>
                  {launch.name}
                </Link>
              </td>
              <td style={{ padding: "10px 12px" }}>
                <StatusBadge status={launch.status} />
              </td>
              <td style={{ padding: "10px 12px", fontSize: 13, color: "#666" }}>
                {format(new Date(launch.start_time), "MMM d, yyyy HH:mm")}
              </td>
              <td style={{ padding: "10px 12px" }}>
                <StatsBar launch={launch} />
              </td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{launch.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span style={{ padding: "6px 12px" }}>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default LaunchList;
