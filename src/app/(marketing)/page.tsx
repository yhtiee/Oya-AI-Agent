import { Asks } from "@/components/marketing/Asks";
import { Categories } from "@/components/marketing/Categories";
import { Closing } from "@/components/marketing/Closing";
import { Faq } from "@/components/marketing/Faq";
import { Features } from "@/components/marketing/Features";
import { Founder } from "@/components/marketing/Founder";
import { Hero } from "@/components/marketing/Hero";
import { Nav } from "@/components/marketing/Nav";
import { Rollout } from "@/components/marketing/Rollout";
import { Statement } from "@/components/marketing/Statement";
import { WebApp } from "@/components/marketing/WebApp";

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
