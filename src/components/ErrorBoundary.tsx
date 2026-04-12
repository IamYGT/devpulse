import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[DevPulse] Component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          padding: 20,
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8,
          color: "#f87171",
          fontSize: 13,
          margin: "8px 0",
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Bilesen yuklenemedi</div>
          <div style={{ fontSize: 11, color: "#999" }}>
            {this.state.error?.message || "Bilinmeyen hata"}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
