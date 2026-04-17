"use client";

import { useState } from "react";
import {
  Star,
  Send,
  Bug,
  Lightbulb,
  Heart,
  MessageSquare,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppHeader } from "@/components/layout/app-header";
import {
  FormField,
  FormGroup,
  FormTextarea,
} from "@/components/ui/form-primitives";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const categories = [
  { value: "review", label: "Review", icon: Star, color: "text-yellow-500" },
  { value: "bug", label: "Bug Report", icon: Bug, color: "text-red-500" },
  { value: "feature", label: "Feature Request", icon: Lightbulb, color: "text-blue-500" },
  { value: "testimonial", label: "Testimonial", icon: Heart, color: "text-pink-500" },
];

export default function FeedbackPage() {
  const user = useAuthStore((s) => s.user);
  const [category, setCategory] = useState("review");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please write your feedback");
      return;
    }

    setLoading(true);
    try {
      const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id,
          user_email: user?.email,
          user_name: user?.name,
          category,
          rating: category === "review" || category === "testimonial" ? rating : null,
          message: message.trim(),
          page: "feedback",
          device: isMobile ? "mobile" : "desktop",
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        toast.success("Thank you for your feedback!");
      } else {
        toast.error("Failed to submit. Please try again.");
      }
    } catch {
      toast.error("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div>
        <AppHeader title="Feedback" showBack />
        <div className="p-4 flex flex-col items-center justify-center py-20 space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Thank You!</h2>
          <p className="text-sm text-muted-foreground text-center">
            Your feedback has been received. We read every single one and use it to make MediFamily better.
          </p>
          <Button variant="outline" onClick={() => { setSubmitted(false); setMessage(""); setRating(0); }}>
            Send Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader title="Feedback & Reviews" showBack />
      <div className="p-4">
        <Card className="bg-primary/5 border-primary/20 mb-6">
          <CardContent className="py-3">
            <p className="text-[13px] text-muted-foreground">
              Your feedback helps us improve MediFamily. Report bugs, suggest features, or tell us what you think.
            </p>
          </CardContent>
        </Card>

        <FormGroup title="Category">
          <div className="grid grid-cols-4 gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all active:scale-[0.97]",
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/40"
                      : "bg-muted/60 hover:bg-muted"
                  )}
                >
                  <Icon className={cn("h-5 w-5", isSelected ? cat.color : "text-muted-foreground")} />
                  <span className="text-[11px] font-medium">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </FormGroup>

        {(category === "review" || category === "testimonial") && (
          <FormGroup title="Rating">
            <div className="flex justify-center gap-1 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 active:scale-90 transition-transform"
                >
                  <Star
                    className={cn(
                      "h-9 w-9 transition-colors",
                      star <= (hoverRating || rating)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-muted-foreground/30"
                    )}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-center text-[13px] font-medium text-muted-foreground">
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent!"}
              </p>
            )}
          </FormGroup>
        )}

        <FormGroup
          title={
            category === "bug"
              ? "Describe the bug"
              : category === "feature"
              ? "Your idea"
              : category === "review"
              ? "Your review"
              : "Your story"
          }
        >
          <FormField label="Message">
            <FormTextarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === "bug"
                  ? "I was trying to... and it showed..."
                  : category === "feature"
                  ? "I wish MediFamily could..."
                  : "Your feedback here..."
              }
              rows={5}
              maxLength={2000}
            />
            <p className="text-[11px] text-muted-foreground text-right pt-1">
              {message.length}/2000
            </p>
          </FormField>
        </FormGroup>

        <Button
          className="w-full h-12 rounded-xl text-[15px] font-semibold shadow-md shadow-primary/15 transition-transform active:scale-[0.98]"
          onClick={handleSubmit}
          disabled={loading || !message.trim()}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
          ) : (
            <><Send className="h-4 w-4 mr-2" />Submit feedback</>
          )}
        </Button>
      </div>
    </div>
  );
}
