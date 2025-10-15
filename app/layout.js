export const metadata = { title: "Plushy Generator" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif" }}>{children}</body>
    </html>
  );
}
