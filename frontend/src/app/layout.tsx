import type { Metadata } from "next";
import { Archivo, Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Paragon Affiliate Analytics",
  description: "Affiliate marketing performance analytics",
};

// Applies the saved theme before first paint, so a light-mode reader never sees a dark flash.
const themeBootstrap = `try{var d=document.documentElement;var t=localStorage.getItem("ov-theme");d.dataset.theme=t==="light"?"light":"dark";var s=localStorage.getItem("ov-sidebar");d.dataset.sidebar=s==="rail"?"rail":"full"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-sidebar="full"
      // The bootstrap script below rewrites both attributes before hydration.
      suppressHydrationWarning
      className={`${archivo.variable} ${barlow.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col text-foreground font-(family-name:--font-barlow)">
        {children}
      </body>
    </html>
  );
}
