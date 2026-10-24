/**
 * Curated knowledge base the coach is allowed to answer from.
 *
 * In a production system each document would move through a clinician review
 * workflow (draft -> reviewed -> published) before ingestion. Here the review
 * metadata models that workflow; the content itself is general patient
 * education written for this demo and is NOT clinically reviewed.
 */
export interface KnowledgeDoc {
  id: string;
  title: string;
  category: "side-effects" | "nutrition" | "activity" | "medication" | "safety" | "lifestyle";
  review: { status: "published" | "draft"; reviewer: string; reviewedOn: string };
  body: string;
}

const REVIEW = { status: "published" as const, reviewer: "Demo reviewer (placeholder)", reviewedOn: "2026-10-01" };

export const KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: "nausea",
    title: "Managing nausea on GLP-1 therapy",
    category: "side-effects",
    review: REVIEW,
    body: `Nausea is the most common side effect of GLP-1 medications and is usually strongest in the first weeks and for a few days after a dose increase. It typically improves as the body adjusts.
Eat smaller meals and stop eating as soon as you feel comfortably full. GLP-1 medications slow stomach emptying, so portions that felt normal before may now feel like too much.
Choose bland, lower-fat foods such as crackers, toast, rice, bananas, and broth when nausea is active. Greasy, fried, very sweet, or spicy foods often make nausea worse.
Eat slowly, chew well, and avoid lying down for two to three hours after eating.
Sip fluids between meals rather than drinking large amounts with meals. Cold water, ginger tea, or peppermint tea can help some people.
Contact your care team if nausea prevents you from keeping food or fluids down for more than a day, or if it comes with severe abdominal pain.`,
  },
  {
    id: "constipation",
    title: "Preventing and relieving constipation",
    category: "side-effects",
    review: REVIEW,
    body: `Constipation is common on GLP-1 therapy because digestion slows down and people often eat and drink less overall.
Aim for consistent hydration through the day. Many adults do well with roughly eight cups of fluid daily unless their clinician has advised a fluid restriction.
Increase fiber gradually from vegetables, fruit, beans, lentils, oats, chia, and whole grains. Increasing fiber too fast can cause bloating.
Daily movement such as a 10 to 20 minute walk helps stimulate the bowels.
Ask your care team before starting a laxative or fiber supplement so they can recommend an option that fits your other medications.
Contact your care team if you have no bowel movement for several days with abdominal swelling, severe pain, or vomiting.`,
  },
  {
    id: "hydration",
    title: "Hydration and dehydration warning signs",
    category: "safety",
    review: REVIEW,
    body: `Reduced appetite on GLP-1 therapy often means reduced fluid intake too, since a lot of daily water normally comes from food.
Keep a water bottle visible and sip regularly. Broth, herbal tea, and water-rich foods like cucumber and melon count toward hydration.
If you are vomiting or have diarrhea, replace fluids with small frequent sips and consider an oral rehydration solution.
Warning signs of dehydration include dark urine, urinating much less than usual, dizziness when standing, dry mouth, and unusual fatigue.
Dehydration can stress the kidneys. Contact your care team promptly if you cannot keep fluids down or have signs of dehydration.`,
  },
  {
    id: "protein",
    title: "Protein intake and preserving muscle",
    category: "nutrition",
    review: REVIEW,
    body: `When eating less, protein becomes especially important to help preserve lean muscle mass during weight loss.
Your dietitian will set a personal protein target. Many plans aim for a protein source at every meal and snack.
Eat the protein portion of your meal first, before starches, so you get it in before you feel full.
Easy protein sources include Greek yogurt, cottage cheese, eggs, fish, chicken, tofu, tempeh, lentils, edamame, and protein shakes.
If solid food is hard to tolerate, a protein shake or smoothie can help you reach your target.
Pair adequate protein with resistance exercise for the best chance of preserving muscle.`,
  },
  {
    id: "meal-structure",
    title: "Meal structure when appetite is low",
    category: "nutrition",
    review: REVIEW,
    body: `Low appetite can lead to skipped meals and then overeating later, which can trigger nausea. A regular eating rhythm helps.
Try three small meals plus one or two planned snacks rather than waiting until you feel hungry.
Build plates with protein first, then non-starchy vegetables, then smaller portions of whole-grain starch.
Use a smaller plate and serve smaller portions; you can always have more if you are still hungry.
Pay attention to early fullness signals and stop eating at the first sign of fullness.
When eating out, consider ordering an appetizer-sized portion or boxing half the meal at the start.`,
  },
  {
    id: "activity",
    title: "Physical activity and strength training",
    category: "activity",
    review: REVIEW,
    body: `Regular physical activity supports heart health, mood, blood sugar, and helps preserve muscle during weight loss.
A common goal is about 150 minutes per week of moderate activity such as brisk walking, plus resistance training two or more days per week.
Resistance training can include bodyweight exercises like squats, wall push-ups, and step-ups, as well as resistance bands or weights.
Start where you are. Short 10 minute sessions count and can be built up gradually.
If you have heart disease, joint problems, or have been inactive for a long time, check with your care team before starting a new exercise program.
Eat and hydrate adequately around workouts, especially if appetite is low.`,
  },
  {
    id: "dose-escalation",
    title: "Dose escalation and why you should not change your dose",
    category: "medication",
    review: REVIEW,
    body: `GLP-1 medications are usually started at a low dose and increased step by step over weeks to months to improve tolerability.
Your prescriber decides when and whether to increase your dose. Do not increase, decrease, or skip doses on your own.
If side effects are hard to tolerate after a dose increase, contact your care team. Options may include staying at the current dose longer.
Bring a list of your side effects, their timing, and severity to your appointments so your clinician can make informed decisions.`,
  },
  {
    id: "missed-dose",
    title: "If you miss a dose",
    category: "medication",
    review: REVIEW,
    body: `Instructions for a missed dose differ between GLP-1 medications and products.
Check the medication guide that came with your prescription for the specific missed-dose window for your product.
Do not take two doses close together to make up for a missed dose.
If you have missed more than one dose in a row, contact your care team before restarting, because restarting at your previous dose may increase side effects.`,
  },
  {
    id: "injection",
    title: "Injection technique and site rotation",
    category: "medication",
    review: REVIEW,
    body: `Weekly GLP-1 injections are usually given under the skin of the abdomen, thigh, or upper arm.
Rotate injection sites each week to reduce skin irritation.
Take your injection on the same day each week. Setting a phone reminder can help.
Store pens as directed in your medication guide and check expiration dates.
Mild redness at the injection site is common. Contact your care team if you notice spreading redness, warmth, or swelling.`,
  },
  {
    id: "hypoglycemia",
    title: "Low blood sugar risk with other diabetes medications",
    category: "safety",
    review: REVIEW,
    body: `GLP-1 medications alone rarely cause low blood sugar, but the risk is higher when combined with insulin or sulfonylureas.
Symptoms of low blood sugar include shakiness, sweating, fast heartbeat, confusion, irritability, and hunger.
If you take insulin or a sulfonylurea and check your glucose, a reading below 70 mg/dL is considered low. Follow the treatment plan your care team gave you, which commonly involves 15 grams of fast-acting carbohydrate and rechecking after 15 minutes.
Tell your care team about any low readings so they can adjust your other medications if needed.`,
  },
  {
    id: "red-flags",
    title: "Symptoms that need urgent medical attention",
    category: "safety",
    review: REVIEW,
    body: `Seek emergency care for severe, persistent abdominal pain that may spread to the back, with or without vomiting. This can be a sign of pancreatitis.
Seek care for pain in the upper right abdomen, fever, or yellowing of the skin or eyes, which can be signs of gallbladder problems.
Seek emergency care for swelling of the face, lips, tongue, or throat, or trouble breathing or swallowing, which can be signs of a serious allergic reaction.
Contact your care team about a lump or swelling in the neck, trouble swallowing, or persistent hoarseness.
If you have thoughts of harming yourself, call or text 988 (Suicide and Crisis Lifeline in the U.S.) or seek emergency care.`,
  },
  {
    id: "alcohol",
    title: "Alcohol while on GLP-1 therapy",
    category: "lifestyle",
    review: REVIEW,
    body: `Many people notice they want less alcohol on GLP-1 therapy, and alcohol can worsen nausea and dehydration.
Alcohol adds calories with little nutrition and can lower blood sugar in people who also take insulin or sulfonylureas.
If you choose to drink, have it with food, alternate with water, and keep amounts small.
Talk with your care team about what is safe for you, especially if you have a history of pancreatitis or liver disease.`,
  },
  {
    id: "plateau",
    title: "Weight-loss plateaus",
    category: "lifestyle",
    review: REVIEW,
    body: `Weight loss is rarely a straight line, and plateaus are a normal part of treatment.
Focus on behaviors you control: protein at each meal, regular activity, sleep, and hydration.
Non-scale victories like more energy, better-fitting clothes, improved blood pressure, or better glucose readings are meaningful progress.
Track trends over several weeks rather than daily weigh-ins.
Discuss a prolonged plateau with your care team; they can review your plan and medication.`,
  },
  {
    id: "sleep-stress",
    title: "Sleep, stress, and emotional eating",
    category: "lifestyle",
    review: REVIEW,
    body: `Poor sleep and high stress can increase cravings and make healthy routines harder.
Many adults benefit from seven to nine hours of sleep with a consistent bedtime and wake time.
When cravings show up, pause and ask whether you are physically hungry, tired, stressed, or bored.
Short walks, breathing exercises, or calling a friend can be alternatives to stress eating.
If low mood or anxiety is affecting your daily life, let your care team know so they can connect you with support.`,
  },
];

export interface Chunk {
  id: string;
  docId: string;
  title: string;
  text: string;
}

/** Sentence-level chunks: the docs are short, so a line is a self-contained fact. */
export const CHUNKS: Chunk[] = KNOWLEDGE.filter((d) => d.review.status === "published").flatMap((doc) =>
  doc.body
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `${doc.id}#${i}`, docId: doc.id, title: doc.title, text })),
);
