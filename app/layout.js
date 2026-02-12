import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "PicJuno",
  description: "Every Moment, Delivered.",
  // 앱 설치 시 필요한 설정 (manifest.json 파일 필요)
  manifest: "/manifest.json", 
  // 브라우저 탭, 즐겨찾기, 홈 화면 아이콘 설정
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png", // 아이폰/아이패드용
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={inter.className}>{children}</body>
    </html>
  );
}