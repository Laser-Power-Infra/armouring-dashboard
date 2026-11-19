import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./cards.css";

// The cards keep their approved look (build spec 2.2): Roboto 400 and 700, not the dashboard's Inter.
const roboto = Roboto({ variable: "--font-roboto", weight: ["400", "700"], subsets: ["latin"] });

export const metadata: Metadata = { title: "KGP cards" };

export default function CardsLayout({ children }: LayoutProps<"/cards">) {
  return <div className={`${roboto.variable} flex flex-1 flex-col`}>{children}</div>;
}
