export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f5f5f5",
        fontFamily: "sans-serif",
        color: "#333",
      }}
    >
      <img
        src="/rrrc-logo.svg"
        alt="Red Rock Running Company Logo"
        style={{ width: "350px", marginBottom: "2rem" }}
      />
      <h1>Welcome to the Red Rock Running Company Fit App</h1>
      <p style={{ marginTop: "1rem" }}>
        Track your customers’ shoe fit sessions and insights.
      </p>
      <button
        style={{
          marginTop: "2rem",
          backgroundColor: "#c91f37",
          color: "white",
          border: "none",
          padding: "0.75rem 1.5rem",
          borderRadius: "6px",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        Start a Fit Session
      </button>
    </main>
  );
}
