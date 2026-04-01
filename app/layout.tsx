import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPUStat Live",
  description: "Live dashboard for gpustat -cp -i 1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
