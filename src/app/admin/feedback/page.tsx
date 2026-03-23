"use client";

import { useState, useEffect } from "react";
import {
  Star,
  Bug,
  Lightbulb,
  Heart,
  MessageSquare,
  Eye,
  CheckCircle,
  Archive,
  Clock,
  Filter,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackItem {
  id: string;
  user_email: string | null;
  user_name: string | null;
  category: string;
  rating: number | null;
  message: string;
  page: string | null;
  device: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  new: number;
  avgRating: { _avg: { rating: number | null } };
}

const categoryIcon: Record<string, typeof Star> = {
  review: Star,
  bug: Bug,
  feature: Lightbulb,
  testimonial: Heart,
};

const categoryColor: Record<string, string> = {
  review: "text-yellow-500",
  bug: "text-red-500",
  feature: "text-blue-500",
  testimonial: "text-pink-500",
};

const statusColor: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  read: "bg-gray-100 text-gray-800",
  resolved: "bg-green-100 text-green-800",
  archived: "bg-yellow-100 text-yellow-800",
};

export default function AdminFeedbackPage() {
  const [adminKey, setAdminKey] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const fetchFeedback = async (key: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ key });
      if (filter !== "all") params.set("status", filter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);

      const res = await fetch(`/api/feedback?${params}`);
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback);
        setStats(data.stats);
        setIsAuthed(true);
      } else {
        alert("Invalid admin key");
      }
    } catch {
      alert("Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch("/api/feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, key: adminKey }),
    });
    fetchFeedback(adminKey);
  };

  useEffect(() => {
    if (isAuthed) fetchFeedback(adminKey);
  }, [filter, categoryFilter]);

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="password"
              placeholder="Enter admin key (JWT_SECRET)"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchFeedback(adminKey)}
            />
            <Button className="w-full" onClick={() => fetchFeedback(adminKey)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">Feedback Dashboard</h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
                <p className="text-xs text-muted-foreground">New</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold">
                  {stats.avgRating._avg.rating ? stats.avgRating._avg.rating.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg Rating</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["all", "new", "read", "resolved", "archived"].map((s) => (
            <Badge
              key={s}
              variant={filter === s ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setFilter(s)}
            >
              {s}
            </Badge>
          ))}
          <span className="text-muted-foreground">|</span>
          {["all", "review", "bug", "feature", "testimonial"].map((c) => (
            <Badge
              key={c}
              variant={categoryFilter === c ? "default" : "outline"}
              className="cursor-pointer capitalize"
              onClick={() => setCategoryFilter(c)}
            >
              {c}
            </Badge>
          ))}
        </div>

        {/* Feedback List */}
        {loading ? (
          <div className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : feedback.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No feedback yet</p>
        ) : (
          <div className="space-y-3">
            {feedback.map((item) => {
              const Icon = categoryIcon[item.category] || MessageSquare;
              return (
                <Card key={item.id}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${categoryColor[item.category] || ""}`} />
                        <span className="text-sm font-medium capitalize">{item.category}</span>
                        <Badge className={`text-[10px] ${statusColor[item.status] || ""}`}>
                          {item.status}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Rating */}
                    {item.rating && (
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= item.rating! ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
                        ))}
                      </div>
                    )}

                    {/* Message */}
                    <p className="text-sm">{item.message}</p>

                    {/* User Info */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {item.user_name && <span>{item.user_name}</span>}
                      {item.user_email && <span>({item.user_email})</span>}
                      {item.device && <Badge variant="outline" className="text-[9px]">{item.device}</Badge>}
                    </div>

                    {/* Admin Note */}
                    {item.admin_note && (
                      <div className="bg-muted p-2 rounded text-xs">
                        <span className="font-medium">Admin: </span>{item.admin_note}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(item.id, "read")}>
                        <Eye className="h-3 w-3 mr-1" />Read
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(item.id, "resolved")}>
                        <CheckCircle className="h-3 w-3 mr-1" />Resolved
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => updateStatus(item.id, "archived")}>
                        <Archive className="h-3 w-3 mr-1" />Archive
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
