import type { IconName } from "@/components/icons";

/* ---------- Hero: things people on the street ask Oya ---------- */

export type HeroAsk = {
  id: string;
  /** Short label when the ask also appears as a chip under the input. */
  chip?: string;
  ask: string;
  reply: string;
  action?: string;
};

// Oya answers in the language it's spoken to. At least half of these involve no purchase.
export const HERO_ASKS: HeroAsk[] = [
  {
    id: "power",
    chip: "Light don go",
    ask: "Light don go again. When e go come back?",
    reply: "Sorry o. 23 people on your street don report am. E dey usually come back around 6pm. I go buzz you as e land.",
  },
  {
    id: "plumber",
    chip: "My tap is leaking",
    ask: "My kitchen tap don dey leak since morning. I need plumber tomorrow.",
    reply: "No wahala. Emeka can come at 11am. People rate him 4.8 and he's charging ₦8,000. I'll hold the money until you say the tap is fixed.",
    action: "Book Emeka",
  },
  {
    id: "passport",
    chip: "Renew my passport",
    ask: "I wan renew my passport. Wetin I need?",
    reply: "Your old passport, NIN slip and one passport photo. Pay only the official fee. The earliest slot is Thursday at 10am.",
    action: "Book Thursday",
  },
  {
    id: "clinic",
    chip: "Clinic open now",
    ask: "My son has a fever. Which clinic near me is open now?",
    reply: "Ewet Family Clinic is open till 10pm, 1.2 km away. They can see him at 4:30. If he's struggling to breathe or won't wake up, call 112 now.",
    action: "Book 4:30",
  },
  {
    id: "papers",
    chip: "Car papers",
    ask: "Remind me say my car papers go expire this month.",
    reply: "Noted. I'll remind you on the 20th with everything you need to renew.",
  },
  {
    id: "generator",
    ask: "Generator no gree start. Who fit fix am today?",
    reply: "Two repairers close to you can come today. Tunde is the closest, and people say he doesn't overcharge. Should I call him?",
    action: "Call Tunde",
  },
  {
    id: "price",
    ask: "How much is a bag of rice at Akpan Andem market today?",
    reply: "Let me ask three traders there. I'll send you today's prices in a few minutes.",
  },
  {
    id: "outing",
    ask: "Find me a quiet place to hang out this Saturday. Nothing too expensive.",
    reply: "I've got three ideas near you, all open on Saturday. Want them by price or by distance?",
  },
  {
    id: "fuel",
    ask: "Any fuel station with no queue around Ikot Ekpene Road?",
    reply: "8 drivers say the station 2 km from you has fuel and a short queue right now.",
    action: "Get directions",
  },
  {
    id: "house",
    ask: "Find me a self-contain under ₦400k close to Uniuyo.",
    reply: "I found 4 that are real and still available. I can book inspections for Saturday morning.",
    action: "Book inspections",
  },
  {
    id: "pharmacy",
    ask: "Abeg, which pharmacy near me get Amatem?",
    reply: "Two licensed pharmacies near you have it in stock. I can ask the closest one to hold a pack for you.",
    action: "Hold a pack",
  },
  {
    id: "farm",
    ask: "Who dey buy mango for bulk this season?",
    reply: "I know three buyers who collect from farms around here. I'll get their prices and when they can pick up.",
  },
];

export const HERO_ASK_BY_ID = Object.fromEntries(HERO_ASKS.map((a) => [a.id, a])) as Record<string, HeroAsk>;

/* ---------- A day on the street ---------- */

export type BuildingId = "bungalow" | "storey" | "kiosk" | "block" | "house" | "lodge" | "keke" | "mango";

export type DayAsk = {
  /** Hour of the day as a decimal, e.g. 9.67 for 9:40. */
  hour: number;
  time: string;
  who: string;
  building: BuildingId;
  text: string;
  voice?: boolean;
  reply: string;
};

// The people are made up; the kinds of requests are the real ones Oya is for.
export const DAY_ASKS: DayAsk[] = [
  { hour: 6.03, time: "6:02 am", who: "Mrs Bassey, No. 4", building: "bungalow", text: "Light don come for Ewet?", reply: "Not yet. 12 neighbours say it went off at 5. It usually comes back by 7, I go buzz you." },
  { hour: 8.23, time: "8:14 am", who: "Chidi, Block C", building: "block", text: "Abeg, which pharmacy near me get Amatem?", reply: "Two licensed pharmacies near you have it. I've asked the closest one to hold a pack for you." },
  { hour: 9.67, time: "9:40 am", who: "Mr Udoh, No. 12", building: "storey", text: "Generator no gree start. Who fit fix am today?", voice: true, reply: "Tunde can come by 11. People say he doesn't overcharge. Should I call him?" },
  { hour: 10.08, time: "10:05 am", who: "Aniekan, No. 7", building: "house", text: "What do I need for NIN modification?", reply: "Your NIN slip, a valid ID and a document with the right details. I'll send the official fee and the nearest office." },
  { hour: 11.52, time: "11:31 am", who: "Mama Ini's kiosk", building: "kiosk", text: "How much is a bag of rice at Akpan Andem market today?", reply: "Let me ask three traders there. You'll have today's prices in a few minutes." },
  { hour: 12.33, time: "12:20 pm", who: "Blessing, Grace Lodge", building: "lodge", text: "Find me a self-contain under ₦400k close to Uniuyo.", reply: "I found 4 that are real and still available. Shall I book inspections for Saturday morning?" },
  { hour: 13.03, time: "1:02 pm", who: "Tobi, No. 21", building: "mango", text: "Remind me when JAMB registration opens.", reply: "Noted. I'll message you the day it opens, with everything you need to bring." },
  { hour: 14.78, time: "2:47 pm", who: "Mrs Bassey, No. 4", building: "bungalow", text: "Gas don finish. Who get 12.5kg refill near me?", voice: true, reply: "Two sellers close by have refills at a fair price. One can deliver within the hour. Should I book?" },
  { hour: 15.25, time: "3:15 pm", who: "Sunday, keke driver", building: "keke", text: "Is the road to Eket flooded?", reply: "5 people on that road say yes, near the bridge. Take the old road instead. I'll send the route." },
  { hour: 16.13, time: "4:08 pm", who: "Chidi, Block C", building: "block", text: "I need a lawyer for a change of name affidavit.", reply: "A commissioner for oaths near you can do it today. I'll tell you the cost before you go." },
  { hour: 17.37, time: "5:22 pm", who: "Aniekan, No. 7", building: "house", text: "Which lab does malaria test, and how much?", reply: "Two labs near you do it. The cheaper one is open till 7. Want directions?" },
  { hour: 18.67, time: "6:40 pm", who: "Blessing, Grace Lodge", building: "lodge", text: "Book me a braider for Saturday morning.", reply: "Ekaete has a slot at 9am on Saturday. I've held it for you." },
  { hour: 19.92, time: "7:55 pm", who: "Kunle, No. 12", building: "storey", text: "Cancel my laundry pickup, I'm travelling.", reply: "Done. Pickup cancelled, and the laundry knows you're back on the 14th." },
  { hour: 21.17, time: "9:10 pm", who: "Sunday, keke driver", building: "keke", text: "Any fuel station with no queue around Ikot Ekpene Road?", voice: true, reply: "8 drivers say the station 2 km from you has fuel and a short queue right now." },
];

/* ---------- Categories ---------- */

export type Category = { name: string; icon: IconName; agent: string; get: string };
export type Pack = {
  id: string;
  name: string;
  icon: IconName;
  blurb: string;
  badge?: string;
  items: Category[];
};

export const PACKS: Pack[] = [
  {
    id: "essentials",
    name: "Everyday essentials",
    icon: "power",
    badge: "Where Oya starts",
    blurb: "The things people chase every single day. These come first.",
    items: [
      { name: "Power & light", icon: "power", agent: "Tracks supply on your street and warns you before prepaid units run out", get: "Plan around light, never caught at zero units" },
      { name: "Food", icon: "food", agent: "Finds your dish within budget, confirms it's available, pays and tracks", get: "The meal you wanted, on budget, paid only on arrival" },
      { name: "Artisans & home repairs", icon: "artisans", agent: "Turns a photo or voice note into 3 rated quotes, then books", get: "Fixed at the agreed price, no-shows replaced" },
      { name: "Government runs", icon: "gov", agent: "The exact checklist and official fee for NIN, passport or CAC, then tracks status", get: "Done in the fewest trips, at the official fee, no touts" },
      { name: "Pharmacy", icon: "pharmacy", agent: "Checks stock and price at licensed pharmacies and reserves it", get: "Know in minutes who has it, held for you" },
    ],
  },
  {
    id: "home",
    name: "Home & living",
    icon: "house",
    blurb: "Finding a place, keeping it running, and the help that makes it easier.",
    items: [
      { name: "House & room hunting", icon: "house", agent: "Checks listings are real and available, books inspections", get: "Inspect only real homes in budget, no fake agents" },
      { name: "Cooking gas", icon: "gas", agent: "Learns your refill cycle, finds the best price per kg, books", get: "Never run out by surprise, and pay a fair price" },
      { name: "Moving", icon: "moving", agent: "Gets quotes from packers and trucks, tracks move day", get: "Moved on the agreed date and price, nothing lost" },
      { name: "Laundry & cleaning", icon: "laundry", agent: "Finds pickup laundry or cleaners, confirms price, schedules", get: "Clothes and house done on time, no chasing" },
      { name: "Domestic staff", icon: "staff", agent: "Finds candidates, checks references and guarantors", get: "A vetted hire quickly, guarantor on record" },
    ],
  },
  {
    id: "health",
    name: "Health & school",
    icon: "clinic",
    blurb: "Getting seen quickly, and getting children into the right school on time.",
    items: [
      { name: "Hospitals, clinics & labs", icon: "clinic", agent: "Finds the nearest open facility, compares lab prices, books", get: "Know where you can be seen, and roughly what it costs" },
      { name: "Emergency help", icon: "emergency", agent: "Shows the nearest emergency unit and the right numbers for where you are", get: "The right help in seconds. It never replaces emergency services" },
      { name: "Tutors & exam prep", icon: "tutor", agent: "Matches vetted tutors for JAMB, WAEC and school subjects", get: "A reliable tutor, and progress parents can see" },
      { name: "Schools & admissions", icon: "school", agent: "Compares fees and requirements, tracks every admission deadline", get: "The right school, and no missed deadlines" },
    ],
  },
  {
    id: "work",
    name: "Work, money & legal",
    icon: "jobs",
    blurb: "Prices, paperwork and work, done right and at a known cost.",
    items: [
      { name: "Price check", icon: "price", agent: "Checks nearby shops and markets for today's prices", get: "Know what things really cost before you go" },
      { name: "Legal basics", icon: "legal", agent: "Connects vetted lawyers and commissioners for oaths, with clear quotes", get: "Affidavits and agreements done right, known cost" },
      { name: "Jobs & gigs", icon: "jobs", agent: "Matches your skills to local jobs and daily-pay gigs", get: "Real, relevant openings and more interviews" },
      { name: "Wholesale", icon: "wholesale", agent: "Finds bulk suppliers, compares prices, arranges delivery", get: "Restock cheaper and faster than a market trip" },
      { name: "Business services", icon: "business", agent: "Gets quotes and samples for printing, branding and photos", get: "Delivered on time, at the quality agreed" },
    ],
  },
  {
    id: "around",
    name: "Getting around",
    icon: "bus",
    blurb: "Fuel, travel and repairs, without the guesswork or the wasted trip.",
    items: [
      { name: "Fuel", icon: "fuel", agent: "Hears from drivers which stations have fuel, the pump price and the queue", get: "Drive straight to fuel at the best nearby price" },
      { name: "Interstate travel & waybill", icon: "bus", agent: "Compares transport companies, reserves seats, tracks parcels", get: "Travel or send goods without visiting the park first" },
      { name: "Car care", icon: "car", agent: "Works out the fault from a voice note, prices parts, finds vetted mechanics", get: "Car fixed at a fair price, with genuine parts" },
      { name: "Phone & gadget repair", icon: "phone", agent: "Gets quotes from trusted technicians and arranges pickup", get: "Device fixed fast, genuine parts, nothing swapped" },
    ],
  },
  {
    id: "lifestyle",
    name: "Owambe & outings",
    icon: "events",
    blurb: "Parties, outings and looking good, on budget and on time.",
    items: [
      { name: "Events & owambe", icon: "events", agent: "Gathers quotes for venues, caterers, DJs and canopies; runs aso-ebi", get: "Event on budget, and every vendor shows up" },
      { name: "Beauty & grooming", icon: "beauty", agent: "Finds available barbers, braiders and makeup artists, books a slot", get: "The look you wanted, on time, at the agreed price" },
      { name: "Places & outings", icon: "places", agent: "Recommends by vibe, budget and area, checks what's open, reserves", get: "A place that matches the plan, no surprises" },
      { name: "Vets & pets", icon: "pets", agent: "Finds vets and pet shops nearby, compares prices, books visits", get: "Your pet seen quickly by someone trusted" },
    ],
  },
  {
    id: "farm",
    name: "Farm & community",
    icon: "farm",
    blurb: "For farmers, and for whole neighbourhoods looking out for each other.",
    items: [
      { name: "Farm inputs & buyers", icon: "farm", agent: "Connects farmers to seed and fertiliser sellers, and to buyers for the harvest", get: "Cheaper inputs, and produce sold faster at a better price" },
      { name: "Farm services", icon: "tractor", agent: "Finds tractors for hire, livestock vets and storage nearby, then schedules", get: "Farm work done on time, without travelling to find help" },
      { name: "Local alerts", icon: "alerts", agent: "Sends checked alerts on flooding, road closures, fuel scarcity and security", get: "Avoid trouble before it reaches you" },
    ],
  },
];

/* ---------- Promises ---------- */

export const PROMISES = [
  "You decide what Oya remembers about you, and you can see it any time.",
  "Your money moves only when you say the job is done.",
  "Everyone Oya sends your way has been ID-checked and rated by people like you.",
  "Companies only ever see big-picture trends. Never your chats, never your name.",
  "We follow Nigeria's Data Protection Act from day one.",
];

/* ---------- FAQ ---------- */

export const FAQS = [
  {
    q: "What is Oya, exactly?",
    a: "Think of Oya as the one contact who knows somebody for everything. It's an AI assistant that lives in WhatsApp. Tell it what you need by voice note or text and it finds the right person or place, checks what's true today, books, files or pays for you, and keeps following up until it's sorted.",
  },
  {
    q: "Is it really free?",
    a: "Yes. Oya is free for everyone. When a request means paying someone, like a plumber, you pay for the job itself, and the money is held until you confirm it's done.",
  },
  {
    q: "Do I need to download anything?",
    a: "No. Oya works inside WhatsApp, so you just save the number and send a message. There's also a web app if you'd rather compare options on a bigger screen.",
  },
  {
    q: "Can I talk to it in Pidgin?",
    a: "Yes. Pidgin and English work from day one, by voice note or text. Yoruba, Igbo and Hausa are coming as Oya grows across Nigeria.",
  },
  {
    q: "Is Oya a delivery or shopping app?",
    a: "No. Some requests involve buying something, but most are about knowing what's true, booking, finding, remembering and getting paperwork done.",
  },
  {
    q: "How is my money protected?",
    a: "When money moves, it goes through a licensed payment provider and is held until you confirm the job is done. Providers are ID-checked and rated before they get any requests.",
  },
  {
    q: "What happens to my chats?",
    a: "You opt in and can see what's collected and why. Partners only ever see big-picture trends, never your chats or your name.",
  },
  {
    q: "Can Oya help in an emergency?",
    a: "Oya can show you the nearest emergency unit and the right numbers for where you are, fast. It never replaces emergency services. If someone is in danger, call 112 first.",
  },
  {
    q: "When can I use it?",
    a: "Oya is starting in one estate or campus in Nigeria, then a few cities, then everywhere. Leave your number and area, and we'll message you when it reaches you.",
  },
];
