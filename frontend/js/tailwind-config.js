tailwind.config = {
  theme: {
    extend: {
      colors: {
        cream: "#FFFDF8",
        green: {
          DEFAULT: "#4CAF50",
          dark: "#3F9C43",
          light: "#EAF8EC",
        },
        ink: "#111827",
        muted: "#6B7280",
        line: "#E5E7EB",
        free: "#22A559",
        hybrid: "#D8A400",
        paid: "#DC4C4C",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        btn: "12px",
        search: "20px",
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,.06)",
        search: "0 10px 40px rgba(0,0,0,.08)",
        navbar: "2px 0 12px rgba(0,0,0,.03)",
      },
      transitionDuration: {
        DEFAULT: "300ms",
      },
    },
  },
};
