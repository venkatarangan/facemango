/**
 * Curated life-story arcs for friends (SPEC §4.3.1). The arc (beats and their order) is fixed
 * here; the model only fills in the slots (a place, a name, a dish…). Family-friendly and
 * wellbeing-minded: no tragedy, illness or breakups; mild setbacks only (rain, a burnt dinner).
 * Beat text may use {slot} placeholders.
 */

export interface StorySlot {
  key: string;
  /** What the model should invent, with an example. */
  hint: string;
}

export interface StoryTemplate {
  id: string;
  /** Story title, with {slot} placeholders. */
  title: string;
  slots: StorySlot[];
  /** Interests/occupation keywords that make this story a better fit. */
  fits: RegExp;
  minAge?: number;
  maxAge?: number;
  /** Days between beats (divided by the engagement speed). */
  gapDays: [number, number];
  /** Chance that a beat post carries a pack photo, and interest words that steer the pick. */
  photo: number;
  photoHints: string[];
  beats: { title: string; brief: string }[];
}

export const STORY_TEMPLATES: readonly StoryTemplate[] = [
  {
    id: 'new-job',
    title: 'Starting a new job at {company}',
    slots: [
      { key: 'company', hint: 'a fictional workplace fitting their field, e.g. "Brightwave Labs"' },
      { key: 'role', hint: 'their new job title, e.g. "senior designer"' },
    ],
    fits: /work|career|tech|engineer|design|teach|office|startup|market|finance|sales|manage/i,
    minAge: 18,
    maxAge: 64,
    gapDays: [3, 7],
    photo: 0.25,
    photoHints: ['work', 'city'],
    beats: [
      {
        title: 'The offer',
        brief:
          'Shares the news: they accepted a job as {role} at {company}. Excited and a bit nervous.',
      },
      {
        title: 'First day',
        brief: 'First day at {company}: new desk, lots of names to remember, a welcome lunch.',
      },
      {
        title: 'First week',
        brief: 'End of the first week. Learning a lot; one tricky day, but the team is kind.',
      },
      {
        title: 'First project',
        brief: 'Got their first real project as {role}. Busy but loving the challenge.',
      },
      {
        title: 'Settled in',
        brief: 'A month in at {company}: settled in, made work friends, grateful for the change.',
      },
    ],
  },
  {
    id: 'race-training',
    title: 'Training for the {race}',
    slots: [{ key: 'race', hint: 'a fictional local race, e.g. "Lakeside Half Marathon"' }],
    fits: /run|marathon|fitness|gym|sport|athlet|cycl|swim|yoga|outdoor|hik/i,
    maxAge: 70,
    gapDays: [5, 9],
    photo: 0.5,
    photoHints: ['sport', 'fitness', 'nature'],
    beats: [
      {
        title: 'Signed up',
        brief: 'Signed up for the {race}. Day 1 of the training plan; asks for tips.',
      },
      { title: 'Week 2', brief: 'Week 2 of training for the {race}: sore legs, early alarms.' },
      {
        title: 'Rainy run',
        brief: 'A long run in heavy rain; slower than planned but finished it anyway.',
      },
      {
        title: 'Longest run yet',
        brief: 'Longest training run so far for the {race}. Feeling stronger every week.',
      },
      {
        title: 'Taper week',
        brief: 'Taper week before the {race}: resting, eating well, nervous.',
      },
      {
        title: 'Race day',
        brief: 'Finished the {race}! Thanks everyone who cheered them on during training.',
      },
    ],
  },
  {
    id: 'big-trip',
    title: 'Trip to {destination}',
    slots: [
      { key: 'destination', hint: 'a real city or region to visit, e.g. "Kyoto"' },
      { key: 'companion', hint: 'who they travel with, e.g. "my sister" or "two old friends"' },
    ],
    fits: /travel|trip|explor|backpack|photograph|culture|heritage|food/i,
    gapDays: [1, 3],
    photo: 0.8,
    photoHints: ['travel', 'nature', 'city', 'food'],
    beats: [
      {
        title: 'Booked it',
        brief: 'Booked a trip to {destination} with {companion}. Counting the days; asks for tips.',
      },
      { title: 'Packing', brief: 'Packing for {destination}; too many clothes, as always.' },
      {
        title: 'Arrived',
        brief: 'Arrived in {destination} with {companion}. First impressions and first meal.',
      },
      {
        title: 'Rainy day',
        brief: 'Rain all day in {destination}, so plans changed: a cosy café and a museum.',
      },
      { title: 'Best day', brief: 'The best day of the trip so far in {destination}.' },
      {
        title: 'Home again',
        brief: 'Back home from {destination}. Tired, happy, already missing it.',
      },
    ],
  },
  {
    id: 'learning-to-cook',
    title: 'Learning to cook {cuisine} food',
    slots: [
      { key: 'cuisine', hint: 'a cuisine, e.g. "Thai" or "Chettinad"' },
      { key: 'dish', hint: 'a signature dish of that cuisine, e.g. "green curry"' },
    ],
    fits: /cook|food|bak|chef|kitchen|eat|cuisine|recipe/i,
    gapDays: [3, 7],
    photo: 0.6,
    photoHints: ['food', 'cooking'],
    beats: [
      {
        title: 'The plan',
        brief: 'Decided to learn {cuisine} cooking. Bought spices and a recipe book.',
      },
      {
        title: 'First attempt',
        brief: 'First try at {dish}: slightly burnt, but edible. Laughing about it.',
      },
      {
        title: 'Getting better',
        brief: 'Second and third attempts at {dish} came out much better.',
      },
      {
        title: 'Cooked for others',
        brief: 'Cooked a {cuisine} dinner for family or friends. Everyone asked for seconds.',
      },
      {
        title: 'Nailed it',
        brief: 'Finally nailed {dish}. Thinking about which {cuisine} dish to learn next.',
      },
    ],
  },
  {
    id: 'moving-city',
    title: 'Moving to {city}',
    slots: [
      { key: 'city', hint: 'a real city they are moving to, e.g. "Pune"' },
      { key: 'neighbourhood', hint: 'their new neighbourhood, e.g. "Koregaon Park"' },
    ],
    fits: /travel|city|career|work|adventure|design|architect/i,
    minAge: 19,
    gapDays: [4, 8],
    photo: 0.4,
    photoHints: ['city', 'travel'],
    beats: [
      { title: 'Big news', brief: 'Announces they are moving to {city} soon. Mixed feelings.' },
      { title: 'Packing boxes', brief: 'Surrounded by boxes; found old photos while packing.' },
      {
        title: 'Moving day',
        brief: 'Moving day! The van was late, but everything arrived in {neighbourhood}, {city}.',
      },
      {
        title: 'Exploring',
        brief: 'Exploring {neighbourhood}: found a great local café and a park nearby.',
      },
      {
        title: 'Feels like home',
        brief: 'A few weeks in {city} and it is starting to feel like home.',
      },
    ],
  },
  {
    id: 'new-pet',
    title: 'Welcoming {petName} the {petType}',
    slots: [
      { key: 'petName', hint: 'a cute pet name, e.g. "Biscuit"' },
      { key: 'petType', hint: 'the kind of pet, e.g. "puppy", "kitten" or "rabbit"' },
    ],
    fits: /pet|dog|cat|animal|puppy|kitten|nature|family/i,
    gapDays: [3, 7],
    photo: 0.6,
    photoHints: ['pets', 'animal'],
    beats: [
      {
        title: 'The decision',
        brief: 'Decided to adopt a {petType}; visiting a shelter this weekend.',
      },
      { title: 'Gotcha day', brief: 'Brought {petName} the {petType} home! Introduces them.' },
      {
        title: 'First nights',
        brief: 'First nights with {petName}: little sleep, lots of cuddles.',
      },
      {
        title: 'Chewed slipper',
        brief: '{petName} chewed a slipper; training is going slowly, but they are adorable.',
      },
      { title: 'Vet visit', brief: 'First vet visit for {petName}: healthy and happy.' },
      { title: 'Best friends', brief: '{petName} has fully settled in; now inseparable.' },
    ],
  },
  {
    id: 'garden',
    title: 'Growing a {plant} garden',
    slots: [{ key: 'plant', hint: 'what they grow, e.g. "tomato" or "herb"' }],
    fits: /garden|plant|nature|green|flower|outdoor|sustainab/i,
    gapDays: [5, 10],
    photo: 0.6,
    photoHints: ['nature', 'garden'],
    beats: [
      {
        title: 'Seeds',
        brief: 'Planted {plant} seeds on the balcony or backyard. Fingers crossed.',
      },
      { title: 'Sprouts', brief: 'The first {plant} sprouts are up! Checking them every morning.' },
      { title: 'Pests', brief: 'Tiny pests found the {plant} plants; trying a natural fix.' },
      { title: 'Growing well', brief: 'The {plant} garden is growing well after the pest scare.' },
      { title: 'First harvest', brief: 'First {plant} harvest! Shared some with the neighbours.' },
    ],
  },
  {
    id: 'instrument',
    title: 'Learning the {instrument}',
    slots: [
      { key: 'instrument', hint: 'a musical instrument, e.g. "guitar" or "veena"' },
      { key: 'song', hint: 'a well-known folk or classic tune, e.g. "Happy Birthday"' },
    ],
    fits: /music|guitar|sing|piano|violin|band|art|concert/i,
    gapDays: [4, 8],
    photo: 0.3,
    photoHints: ['music', 'hobbies'],
    beats: [
      { title: 'Day one', brief: 'Bought a {instrument} and started lessons. Day one!' },
      { title: 'Sore fingers', brief: 'Week 2 of the {instrument}: sore fingers, slow progress.' },
      { title: 'First song', brief: 'Can finally play {song} on the {instrument}, slowly.' },
      { title: 'Plateau', brief: 'Stuck on a tricky part; practising a little every day.' },
      {
        title: 'Small concert',
        brief: 'Played {song} for family or friends on the {instrument}. Proud moment.',
      },
    ],
  },
  {
    id: 'room-makeover',
    title: 'Redoing the {room}',
    slots: [
      { key: 'room', hint: 'a room at home, e.g. "living room" or "study"' },
      { key: 'colour', hint: 'the new wall colour, e.g. "sage green"' },
    ],
    fits: /design|art|diy|home|decor|architect|craft|interior/i,
    minAge: 20,
    gapDays: [3, 7],
    photo: 0.3,
    photoHints: ['city', 'hobbies'],
    beats: [
      { title: 'The plan', brief: 'Planning a makeover of the {room}; asks which colour to pick.' },
      {
        title: 'Paint day',
        brief: 'Painted the {room} {colour}. Paint everywhere, including hair.',
      },
      {
        title: 'Delivery delay',
        brief: 'The new furniture for the {room} is delayed by a week. Patience!',
      },
      { title: 'The reveal', brief: 'The {room} makeover is done. Before-and-after feelings.' },
    ],
  },
  {
    id: 'course',
    title: 'Taking a {course} course',
    slots: [{ key: 'course', hint: 'something they study, e.g. "photography" or "Spanish"' }],
    fits: /study|learn|read|book|teach|research|languag|photograph|code|tech|science/i,
    gapDays: [5, 9],
    photo: 0.25,
    photoHints: ['work', 'study'],
    beats: [
      {
        title: 'Enrolled',
        brief: 'Enrolled in a {course} course. Excited to learn something new.',
      },
      { title: 'First class', brief: 'First {course} class done; the teacher is great.' },
      {
        title: 'Late nights',
        brief: 'A tough assignment in the {course} course; a couple of late nights.',
      },
      { title: 'Halfway', brief: 'Halfway through the {course} course; it is starting to click.' },
      {
        title: 'Certificate',
        brief: 'Finished the {course} course and got the certificate! Thanks for the support.',
      },
    ],
  },
  {
    id: 'community-event',
    title: 'Organising a {event}',
    slots: [
      { key: 'event', hint: 'a neighbourhood event, e.g. "street food fair" or "book swap"' },
    ],
    fits: /volunteer|community|event|festival|social|friend|charity|food|book/i,
    minAge: 16,
    gapDays: [4, 8],
    photo: 0.4,
    photoHints: ['festivals', 'city'],
    beats: [
      {
        title: 'The idea',
        brief: 'Wants to organise a {event} in the neighbourhood; asks who is in.',
      },
      { title: 'Volunteers', brief: 'So many neighbours volunteered to help with the {event}.' },
      {
        title: 'Weather worry',
        brief: 'Rain is forecast for the {event} weekend; making a backup plan.',
      },
      {
        title: 'Event day',
        brief: 'The {event} happened and the rain held off. A lovely turnout.',
      },
      { title: 'Thank you', brief: 'A thank-you note to everyone who helped with the {event}.' },
    ],
  },
  {
    id: 'craft-project',
    title: 'Making a {project}',
    slots: [{ key: 'project', hint: 'a handmade project, e.g. "wooden bookshelf" or "quilt"' }],
    fits: /craft|diy|wood|knit|sew|art|paint|draw|pottery|make|build|hobb/i,
    gapDays: [4, 8],
    photo: 0.3,
    photoHints: ['hobbies', 'art'],
    beats: [
      { title: 'Started', brief: 'Started making a {project}; bought the materials.' },
      { title: 'A mistake', brief: 'Measured wrong on the {project}; had to redo one part.' },
      { title: 'Progress', brief: 'The {project} is taking shape; halfway there.' },
      { title: 'Finished', brief: 'Finished the {project}! Proud of how it turned out.' },
    ],
  },
];

export const templateById = (id: string) => STORY_TEMPLATES.find((t) => t.id === id);

/** Replaces {slot} placeholders; unknown slots become an empty string. */
export function fillSlots(text: string, slots: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (_, key: string) => slots[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
