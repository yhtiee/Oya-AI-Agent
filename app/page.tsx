import { Asks } from "@/components/landing/Asks";
import { Categories } from "@/components/landing/Categories";
import { Closing } from "@/components/landing/Closing";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { Founder } from "@/components/landing/Founder";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Rollout } from "@/components/landing/Rollout";
import { Statement } from "@/components/landing/Statement";
import { WebApp } from "@/components/landing/WebApp";

// Dark street at dusk → what people ask → the one orange line → what Oya does → the rest → a dark close.
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Asks />
        <Statement />
        <Features />
        <Categories />
        <WebApp />
        <Founder />
        <Rollout />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
