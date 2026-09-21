import type { Metadata } from "next";
import { Archivo, Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { auth } from "@/auth";
import { AuthProvider } from "@/components/auth-provider";
import { isSnapshot } from "@/lib/api";

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
const themeBootstrap = `try{var t=localStorage.getItem("ov-theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A static snapshot has no request to read a session cookie from.
  const session = isSnapshot ? null : await auth();

  return (
    <html
      lang="en"
      data-theme="dark"
      // The bootstrap script below rewrites data-theme before hydration.
      suppressHydrationWarning
      className={`${archivo.variable} ${barlow.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full flex flex-col text-foreground font-(family-name:--font-barlow)">
        <AuthProvider session={session}>{children}</AuthProvider>
      </body>
    </html>
  );
}
