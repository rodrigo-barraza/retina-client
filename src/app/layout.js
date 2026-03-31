import { Inter } from "next/font/google";
import { ThemeProvider } from "../components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Retina Playground",
  description: "Advanced Developer Playground for Prism AI Gateway",
};

/**
 * Inline blocking script that runs before first paint to set `data-theme`
 * from localStorage, preventing FOUC (Flash of Unstyled Content).
 * Must mirror StorageService's key format: "retina:<key>" with JSON values.
 */
const themeInitScript = `
(function(){
  try {
    var raw = localStorage.getItem('retina:theme');
    if (raw) {
      var theme = JSON.parse(raw);
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute('data-theme', theme);
      }
    }
  } catch(e) {}
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.variable}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
