import type { Metadata } from "next";
import {
  Archivo,
  Doto,
  Metal,
  Noto_Sans,
  Noto_Sans_Mono,
} from "next/font/google";
import Script from "next/script";
import { SystemThemeSync } from "@/app/components/theme/SystemThemeSync";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoSansMono = Noto_Sans_Mono({
  subsets: ["latin"],
  variable: "--font-noto-sans-mono",
  display: "swap",
});

const metal = Metal({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-metal",
  display: "swap",
});

const doto = Doto({
  subsets: ["latin"],
  variable: "--font-doto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sunlight to Music Data",
  description: "Light Readings from my Brooklyn Apartment",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInit = `(function(){try{var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${archivo.variable} ${notoSans.variable} ${notoSansMono.variable} ${metal.variable} ${doto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="lux-theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <SystemThemeSync />
        {children}
      </body>
    </html>
  );
}
