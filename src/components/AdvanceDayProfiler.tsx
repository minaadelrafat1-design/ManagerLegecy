import React, { useState } from "react";
import { performanceMonitor, type ProfileSession } from "../state/performance-monitor";

export function AdvanceDayProfiler(): React.ReactNode {
  const [isRunning, setIsRunning] = useState(false);
  const [daysToRun, setDaysToRun] = useState(7);
  const [session, setSession] = useState<ProfileSession | null>(null);
  const [showReport, setShowReport] = useState(false);

  const runProfiler = async (numDays: number) => {
    setIsRunning(true);
    setShowReport(false);

    // Start profiling
    performanceMonitor.startSession();

    // Simulate triggering ADVANCE_DAY actions
    // This would need to be connected to actual game state dispatch
    // For now, we'll just record whatever happens over the next few seconds
    await new Promise((resolve) => setTimeout(resolve, 1000 * numDays));

    // End profiling
    const profiledSession = performanceMonitor.endSession();
    if (profiledSession) {
      setSession(profiledSession);
      setShowReport(true);
    }

    setIsRunning(false);
  };

  const downloadReport = (format: "json" | "csv") => {
    if (!session) return;

    let content = "";
    let filename = "";

    if (format === "json") {
      content = performanceMonitor.exportAsJSON(session);
      filename = `advance-day-profile-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    } else {
      content = performanceMonitor.exportAsCSV(session);
      filename = `advance-day-profile-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    }

    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!showReport) {
    return (
      <div
        style={{
          padding: "1rem",
          border: "1px solid #ccc",
          borderRadius: "4px",
          marginBottom: "1rem",
        }}
      >
        <h3>Advance Day Profiler</h3>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            Days to run:{" "}
            <input
              type="number"
              min="1"
              max="30"
              value={daysToRun}
              onChange={(e) => setDaysToRun(parseInt(e.target.value, 10))}
              disabled={isRunning}
            />
          </label>
        </div>
        <button onClick={() => runProfiler(daysToRun)} disabled={isRunning}>
          {isRunning ? "Running..." : `Run ${daysToRun} Days`}
        </button>
      </div>
    );
  }

  if (!session) {
    return <div>No profiling data available</div>;
  }

  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid #ccc",
        borderRadius: "4px",
        marginBottom: "1rem",
      }}
    >
      <h3>Profiling Results</h3>

      <div
        style={{
          marginBottom: "1rem",
          backgroundColor: "#f5f5f5",
          padding: "1rem",
          borderRadius: "4px",
        }}
      >
        <pre style={{ margin: 0, overflow: "auto", maxHeight: "600px", fontSize: "12px" }}>
          {performanceMonitor.generateReport(session)}
        </pre>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <button onClick={() => downloadReport("json")}>Download JSON</button>
        <button onClick={() => downloadReport("csv")}>Download CSV</button>
        <button onClick={() => setShowReport(false)}>Back</button>
      </div>

      <div
        style={{
          backgroundColor: "#f0f0f0",
          padding: "1rem",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        <h4 style={{ marginTop: 0 }}>Summary</h4>
        <div>
          <strong>Days Profiled:</strong> {session.days.length}
        </div>
        <div>
          <strong>Total Session Time:</strong> {session.totalElapsedMs.toFixed(2)}ms
        </div>
        <div>
          <strong>Avg Time per Day:</strong> {session.avgTimePerDay.toFixed(2)}ms
        </div>
        <div>
          <strong>Slowest Day:</strong> {session.slowestDayOverall.date} (
          {session.slowestDayOverall.elapsedMs.toFixed(2)}ms)
        </div>
        <div>
          <strong>Slowest Hook:</strong> {session.slowestHookOverall.name} (
          {session.slowestHookOverall.elapsedMs.toFixed(2)}ms)
        </div>
      </div>
    </div>
  );
}
