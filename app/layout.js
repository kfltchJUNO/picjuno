import "./globals.css"; // 👈 이 줄이 없으면 디자인이 절대 안 나옵니다!
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "PicJuno",
  description: "Every Moment, Delivered.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}