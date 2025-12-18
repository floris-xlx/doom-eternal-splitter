"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Trash2, Target, Zap } from "lucide-react";

type LiveSplitLogEntry = {
  timestamp: Date;
  connected: boolean;
  data: any;
};

type CollectorLogEntry = {
  timestamp: string;
  message: string;
  type: 'match' | 'info';
  details: {
    template: string;
    x: number;
    y: number;
    percentage: number;
  } | null;
  screenshot_path?: string | null;
};

export default function LogsPage() {
  const [livesplitLogs, setLivesplitLogs] = useState<LiveSplitLogEntry[]>([]);
  const [collectorLogs, setCollectorLogs] = useState<CollectorLogEntry[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const livesplitLogsEndRef = useRef<HTMLDivElement>(null);
  const collectorLogsEndRef = useRef<HTMLDivElement>(null);
  const MAX_LOGS = 100;

  const scrollToBottomLivesplit = () => {
    livesplitLogsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBottomCollector = () => {
    collectorLogsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Poll LiveSplit API
  useEffect(() => {
    if (!isPolling) return;

    const pollApi = async () => {
      try {
        const res = await fetch("/api/livesplit", { cache: "no-store" });
        const data = await res.json();
        
        setLivesplitLogs((prev) => {
          const newLogs = [
            ...prev,
            {
              timestamp: new Date(),
              connected: !!data?.connected,
              data,
            },
          ];
          
          if (newLogs.length > MAX_LOGS) {
            return newLogs.slice(-MAX_LOGS);
          }
          return newLogs;
        });
      } catch (error) {
        setLivesplitLogs((prev) => {
          const newLogs = [
            ...prev,
            {
              timestamp: new Date(),
              connected: false,
              data: { error: "Failed to fetch", message: String(error) },
            },
          ];
          
          if (newLogs.length > MAX_LOGS) {
            return newLogs.slice(-MAX_LOGS);
          }
          return newLogs;
        });
      }
    };

    pollApi();
    const interval = setInterval(pollApi, 3000);
    return () => clearInterval(interval);
  }, [isPolling]);

  // Fetch collector logs
  useEffect(() => {
    if (!isPolling) return;

    const fetchCollectorLogs = async () => {
      try {
        const res = await fetch("/api/collector-logs", { cache: "no-store" });
        const data = await res.json();
        setCollectorLogs(data);
      } catch (error) {
        console.error("Failed to fetch collector logs:", error);
      }
    };

    fetchCollectorLogs();
    const interval = setInterval(fetchCollectorLogs, 3000);
    return () => clearInterval(interval);
  }, [isPolling]);

  useEffect(() => {
    scrollToBottomLivesplit();
  }, [livesplitLogs]);

  useEffect(() => {
    scrollToBottomCollector();
  }, [collectorLogs]);

  const clearLivesplitLogs = () => {
    setLivesplitLogs([]);
  };

  const clearCollectorLogs = () => {
    // Collector logs are read-only from file, can't clear
  };

  const togglePolling = () => {
    setIsPolling((prev) => !prev);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">LiveSplit Connection Logs</h1>
          <p className="text-muted-foreground mt-1">Monitor real-time connection status and API responses</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={togglePolling}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isPolling
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-gray-600 hover:bg-gray-700 text-white"
            }`}
          >
            {isPolling ? "⏸ Pause" : "▶ Resume"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>LiveSplit Entries</CardDescription>
            <CardTitle className="text-2xl">{livesplitLogs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Connected</CardDescription>
            <CardTitle className="text-2xl text-green-500">
              {livesplitLogs.filter((l) => l.connected).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Collector Matches</CardDescription>
            <CardTitle className="text-2xl text-blue-500">
              {collectorLogs.filter((l) => l.type === 'match').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Match %</CardDescription>
            <CardTitle className="text-2xl">
              {collectorLogs.length > 0
                ? (
                    collectorLogs
                      .filter((l) => l.details)
                      .reduce((sum, l) => sum + (l.details?.percentage || 0), 0) /
                    collectorLogs.filter((l) => l.details).length
                  ).toFixed(1) + '%'
                : 'N/A'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="livesplit" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="livesplit" className="rounded-lg">
            <Activity className="w-4 h-4 mr-2" />
            LiveSplit Connection
          </TabsTrigger>
          <TabsTrigger value="collector" className="rounded-lg">
            <Target className="w-4 h-4 mr-2" />
            Collector Matches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="livesplit">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Connection Timeline
                </CardTitle>
                <CardDescription>Live updates every 3 seconds</CardDescription>
              </div>
              <button
                onClick={clearLivesplitLogs}
                className="px-3 py-1.5 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto font-mono text-sm">
                {livesplitLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No logs yet. {isPolling ? "Waiting for data..." : "Polling paused."}
                  </div>
                ) : (
                  livesplitLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        log.connected
                          ? "bg-green-950/20 border-green-800"
                          : "bg-red-950/20 border-red-800"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-muted-foreground">
                          [{formatTime(log.timestamp)}]
                        </span>
                        <Badge
                          variant={log.connected ? "default" : "secondary"}
                          className={
                            log.connected
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-red-600 hover:bg-red-700"
                          }
                        >
                          {log.connected ? "✓ Connected" : "✗ Disconnected"}
                        </Badge>
                      </div>
                      <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
                <div ref={livesplitLogsEndRef} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collector">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Collector Matches
              </CardTitle>
              <CardDescription>Template matches detected by the collector</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto font-mono text-sm">
                {collectorLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No collector logs found.
                  </div>
                ) : (
                  collectorLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border ${
                        log.details
                          ? log.details.percentage >= 95
                            ? "bg-green-950/20 border-green-800"
                            : log.details.percentage >= 80
                            ? "bg-yellow-950/20 border-yellow-800"
                            : "bg-red-950/20 border-red-800"
                          : "bg-muted/50 border-border"
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-muted-foreground text-xs">
                            [{log.timestamp}]
                          </span>
                          {log.details && (
                            <Badge
                              variant="default"
                              className={
                                log.details.percentage >= 95
                                  ? "bg-green-600 hover:bg-green-700"
                                  : log.details.percentage >= 80
                                  ? "bg-yellow-600 hover:bg-yellow-700"
                                  : "bg-red-600 hover:bg-red-700"
                              }
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              {log.details.percentage.toFixed(2)}%
                            </Badge>
                          )}
                        </div>
                        
                        {/* Screenshot and Details */}
                        <div className="flex gap-3">
                          {/* Screenshot Thumbnail */}
                          {log.screenshot_path && (
                            <div className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-muted">
                              <img
                                src={`/api/screenshots/${encodeURIComponent(log.screenshot_path)}`}
                                alt={log.details?.template || 'Screenshot'}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}
                          
                          {/* Details */}
                          <div className="flex-1">
                            {log.details ? (
                              <div className="space-y-1 text-xs">
                                <div className="text-muted-foreground">
                                  <span className="font-semibold text-foreground">Template:</span> {log.details.template}
                                </div>
                                <div className="text-muted-foreground">
                                  <span className="font-semibold text-foreground">Position:</span> ({log.details.x}, {log.details.y})
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">{log.message}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={collectorLogsEndRef} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
