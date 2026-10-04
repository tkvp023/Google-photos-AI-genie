import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientShellWrapper } from "@/components/shell/ClientShellWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Photos",
  description: "Google Photos - Pre-Search Genie MVP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // 1. Intercept console.error via getter/setter to prevent dev-overlay from showing extension warnings
                var handler = console.error;
                try {
                  Object.defineProperty(console, 'error', {
                    get: function() {
                      return function() {
                        for (var i = 0; i < arguments.length; i++) {
                          var a = arguments[i];
                          if (typeof a === 'string' && (
                            a.indexOf('bis_skin_checked') !== -1 ||
                            a.indexOf('bis_register') !== -1 ||
                            a.indexOf('__processed_') !== -1 ||
                            a.indexOf('MetadataWrapper') !== -1
                          )) {
                            return;
                          }
                        }
                        if (typeof handler === 'function') {
                          return handler.apply(console, arguments);
                        }
                      };
                    },
                    set: function(fn) {
                      handler = fn;
                    },
                    configurable: true
                  });
                } catch(e) {}

                // 2. Remove extension-injected attributes from DOM in real-time
                if (typeof MutationObserver !== 'undefined') {
                  var observer = new MutationObserver(function(mutations) {
                    for (var i = 0; i < mutations.length; i++) {
                      var m = mutations[i];
                      if (m.type === 'attributes' && (m.attributeName === 'bis_skin_checked' || m.attributeName === 'bis_register')) {
                        if (m.target && m.target.removeAttribute) {
                          m.target.removeAttribute(m.attributeName);
                        }
                      }
                    }
                  });
                  observer.observe(document.documentElement, {
                    attributes: true,
                    subtree: true,
                    attributeFilter: ['bis_skin_checked', 'bis_register']
                  });
                }
              })();
            `,
          }}
        />
      </head>
      <body className="bg-[#eaedf1] h-full text-[#1f1f1f] font-sans antialiased overflow-hidden flex items-center justify-center" suppressHydrationWarning>
        <ClientShellWrapper>{children}</ClientShellWrapper>
      </body>
    </html>
  );
}
