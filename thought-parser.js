// A JavaScript port of the core of Hold This Thought's reminder reader (ReminderParser.swift and
// ThoughtTitler.swift in the app). Same rules, same defaults, run in the browser: it reads a thought
// and works out when to remind (a countdown, a day and time, or a repeat), where (a place), and a
// short title. The app does more (calendar events, saved places, friends, Apple Intelligence
// titles); this is the text-only part, which in the app is also what runs first.

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6 };
// The app's Settings defaults for vague times
const DEFAULTS = { tomorrowHour: 9, weekendWeekday: 6, weekendHour: 10 };

const has = (text, re) => re.test(text);
// Texting shorthand and common misspellings, fixed before anything is read (the app's list)
const FIXES = [
  [/\b(tuseday|tusday|teusday|tuesdy|tueday)\b/gi, 'tuesday'],
  [/\b(wendsday|wensday|wednsday|wedensday|wenesday|wedsday|wednesdy|wedneday)\b/gi, 'wednesday'],
  [/\b(thursady|thrusday|thurday|thursdy|thurdsay|thrsday|thrusdy)\b/gi, 'thursday'],
  [/\b(frday|firday|fridy|fryday|friady)\b/gi, 'friday'],
  [/\b(satuday|saturady|saterday|satarday|satday|saturdy)\b/gi, 'saturday'],
  [/\b(sundy|sunady|sundey)\b/gi, 'sunday'],
  [/\b(mondy|monady|mondey)\b/gi, 'monday'],
  // "sat 8pm", "at 5am sat"; not "I sat" or "in the sun"
  [/\bsat\b(?=\s*(?:\d|at\b|morning|mornin|night|nite|afternoon|evening|$))/gi, 'saturday'],
  [/(?<=(?:\d|am|pm)\s)sat\b/gi, 'saturday'],
  [/(?<!the\s)(?<!in\s)\bsun\b(?=\s*(?:\d|at\b|morning|mornin|night|nite|afternoon|evening))/gi, 'sunday'],
  [/\b(tomrrow|tomorrw|tomarrow|tomorro|tommorw|tomorroe|tmrw|tmrow|tmr|tmw|tomoro|tomorow|tommorow|tommorrow|2moro|2morrow|2morow)\b/gi, 'tomorrow'],
  [/\b(tonite|2nite|tonigh|tonihgt|tonigt|tongiht|2nyt|2nght|tonyt)\b/gi, 'tonight'],
  [/\b(2mrw|2mro|tmrrw|tmmrw|tomm|tmorrow|tomrw)\b/gi, 'tomorrow'],
  [/\b(tdy|tday|tdai)\b/gi, 'today'],
  [/^tn\b|\btn\b(?=\s+(?:or|ok|okay|k|pls|lol|tho|too)\b)/gi, 'tonight'],
  [/\b(wknd|wkend|wkd)\b/gi, 'weekend'],
  [/\bwk\b/gi, 'week'],
  [/\bweds\b/gi, 'wednesday'],
  [/\bthis\s+(?:aft|arvo|afto)\b/gi, 'this afternoon'],
  [/\b(?:in\s+)?a\s+few\s+(?:mins?|minutes)\b|\bin\s+a\s+few\b(?!\s+(?:days|weeks|hours|hrs))/gi, 'in 10 minutes'],
  [/\b(\d{1,2}(?::\d\d)?)(a|p)\b/gi, '$1 $2m'],
  [/\b(tomorrow|today)\s+am\b/gi, '$1 morning'],
  [/\b(tomorrow|today)\s+pm\b/gi, '$1 afternoon'],
  [/\b(\d{1,2}(?::\d\d)?)\s*ish\b/gi, '$1'],
  [/(?<=^|\s)@\s*(?=[a-z])/gi, 'at '],
  [/(?<=\s)w(?=\s+[a-z])/gi, 'with'],
  [/\bnxt\b/gi, 'next'],
  [/\b(novmber|novemeber)\b/gi, 'november'],
  [/\b(janurary|januray)\b/gi, 'january'],
  [/\babt\b/gi, 'about'],
  [/\b(have|has|got|need|needs|want|going|gotta)\s+2\s+(?=[a-z])(?!by\b|x\b)/gi, '$1 to '],
  [/\b4\s+(?=(?:the|my|a|an|your|our)\b)/gi, 'for '],
  [/\b2day\b/gi, 'today'],
  [/\bwen\b/gi, 'when'],
  [/\b(evry|everey|evrey|ever)\s+(?=(?:day|week|month|morning|night|other|single|sun|mon|tue|wed|thu|fri|sat))/gi, 'every '],
  [/(?<=every\s)sat\b/gi, 'saturday'],
  [/(?<=every\s)sun\b/gi, 'sunday'],
  [/\b(minuts|mintues|minits)\b/gi, 'minutes'],
  [/\btn\b(?=\s*$|\s*[.!?]|\s+at\b)/gi, 'tonight'],
  [/\bnite\b/gi, 'night'],
  [/\bmornin\b/gi, 'morning'],
  [/\bb4\b/gi, 'before'],
  [/\bw\/\s*/gi, 'with '],
  [/\bbi[\s-]weekly\b/gi, 'biweekly'],
];
export const fixedShorthand = text => FIXES.reduce((t, [re, to]) => t.replace(re, to), text.replace(/[’‘]/g, "'"));

const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
const HOURS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const byLength = obj => Object.keys(obj).sort((a, b) => b.length - a.length);
const pad = n => String(n).padStart(2, '0');

// "between 3 and 4 pm", "3-4pm", "6 to 7am": the start of the range
function rangeStarts(text) {
  return text
    .replace(/\bbetween\s+(\d{1,2})(:\d{2})?\s*(am|pm)?\s+and\s+\d{1,2}(?::\d{2})?(?:\s*(am|pm)\b)?/g, (_, h, m, a, b) => `at ${h}${m || ''}${a || b ? ' ' + (a || b) : ''}`)
    .replace(/\b(?:from\s+)?(\d{1,2})(:\d{2})?\s*(am|pm)?\s*(?:-|–|to)\s*\d{1,2}(?::\d{2})?\s*(am|pm)\b/g, (_, h, m, a, b) => `at ${h}${m || ''} ${a || b}`);
}

// "the fifteenth of" → "the 15th of"; "ten to five" → 4:50, "quarter past six" → 6:15
function spokenFractionsAndOrdinals(text) {
  const words = byLength(ORDINALS).join('|');
  text = text.replace(new RegExp(`\\bthe\\s+(?:(twenty|thirty)[\\s-]?)?(${words})\\b(?=\\s+of\\b)`, 'gi'), (_, tens, w) => {
    const n = (tens ? (tens.toLowerCase() === 'twenty' ? 20 : 30) : 0) + ORDINALS[w.toLowerCase()];
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th';
    return `the ${n}${suffix}`;
  });
  const minutes = { five: 5, ten: 10, twenty: 20, 'twenty five': 25, quarter: 15, half: 30 };
  return text.replace(new RegExp(`\\b(five|ten|twenty|twenty five|quarter|half)\\s+(to|till|til|past|after)\\s+(${byLength(HOURS).join('|')}|\\d{1,2})\\b`, 'gi'), (all, a, dir, h) => {
    const hour = HOURS[h.toLowerCase()] ?? +h;
    if (!(hour >= 1 && hour <= 12)) return all;
    const before = ['to', 'till', 'til'].includes(dir.toLowerCase()), amount = minutes[a.toLowerCase()];
    return `at ${before ? (hour === 1 ? 12 : hour - 1) : hour}:${pad(before ? 60 - amount : amount)}`;
  });
}

// Nurse and military times: "at 0700" → 7:00 am, "at 1430" → 2:30 pm
const twentyFourHourTimes = text => text.replace(/\b(at|by|before|around)\s+([01]\d|2[0-3])([0-5]\d)\b(?!\s*(?:[a-z]+\s+)?(?:st|ave|ln|rd|blvd|dr|way)\b)/gi,
  (_, cue, h, m) => `${cue} ${+h % 12 === 0 ? 12 : +h % 12}:${m} ${+h < 12 ? 'am' : 'pm'}`);

// "twenty minutes before five" → 4:40, "10 minutes after 3" → 3:10
function minutesAroundHour(text) {
  const numbers = { five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty five': 25, thirty: 30, forty: 40, 'forty five': 45 };
  const re = new RegExp(`\\b(${[...byLength(numbers), '\\d{1,2}'].join('|')})\\s+(?:minutes?|mins?)\\s+(before|after|past|to)\\s+(${[...byLength(HOURS), '\\d{1,2}'].join('|')})\\b`, 'gi');
  return text.replace(re, (all, a, dir, h) => {
    const m = numbers[a.toLowerCase()] ?? +a, base = HOURS[h.toLowerCase()] ?? +h;
    if (!(base >= 1 && base <= 12) || m >= 60) return all;
    const before = /^(before|to)$/i.test(dir);
    return `at ${before ? (base === 1 ? 12 : base - 1) : base}:${pad(before ? 60 - m : m)}`;
  });
}

// Times written as words: "at seven" → "at 7", "seven thirty pm" → "7:30 pm". Only after at/by/
// around… or before am/pm, o'clock or minutes, so "two apples" stays as is.
function spokenTimesAsDigits(text) {
  const minutes = { fifteen: 15, thirty: 30, 'forty five': 45, 'forty-five': 45, fortyfive: 45, twenty: 20, 'oh five': 5, 'o five': 5, ten: 10, forty: 40, fifty: 50 };
  const ones = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  for (const [tw, t] of Object.entries({ twenty: 20, thirty: 30, forty: 40, fifty: 50 }))
    for (const [ow, o] of Object.entries(ones)) { minutes[`${tw} ${ow}`] = t + o; minutes[`${tw}-${ow}`] = t + o; }
  for (const [ow, o] of Object.entries(ones)) minutes[`oh ${ow}`] = o;
  const re = new RegExp(`\\b(at|by|around|until|till|before|after)?(\\s*)\\b(${byLength(HOURS).join('|')})\\b(?:\\s+(${byLength(minutes).join('|')}))?(?:\\s*(o'?clock))?(?:\\s*(am|pm|a\\.m\\.|p\\.m\\.))?`, 'gi');
  return text.replace(re, (all, cue, space, hourWord, minute, oclock, meridiem) => {
    if (!cue && !minute && !oclock && !meridiem) return all;
    let digits = String(HOURS[hourWord.toLowerCase()]);
    if (minute) digits += ':' + pad(minutes[minute.toLowerCase()]);
    if (meridiem) digits += ' ' + meridiem.toLowerCase().replace(/\./g, '');
    return (cue ? cue + (space || ' ') : space || '') + digits;
  });
}

const normalized = text => rangeStarts(spokenTimesAsDigits(minutesAroundHour(spokenFractionsAndOrdinals(twentyFourHourTimes(fixedShorthand(text))))).toLowerCase())
  .replace(/@\s*(?=\d)/g, 'at ')
  // "around 6", "by 5", "before 6": a time too ("before" and "by" are moved a little earlier later)
  .replace(/\b(?:around|about|approx|by|before|no later than|until|till|til)\s+(\d{1,2}(?::\d\d)?\s*(?:am|pm|a\.m\.|p\.m\.)?)(?=\W|$)(?!\s*(?:min|mins|minutes|hour|hours|hrs|day|days|week|weeks|people|bucks|dollars|percent|%|items|pages))/g, 'at $1')
  // "at 5 30", "at 5.30", "5.30 pm" → 5:30
  .replace(/\b(at|by|around|til|until)\s+(\d{1,2})[ .]([0-5]\d)\b/g, '$1 $2:$3')
  .replace(/\b(\d{1,2})\.([0-5]\d)\s*(am|pm|a\.m|p\.m)/g, '$1:$2 $3')
  .replace(/a\.m\.?/g, 'am').replace(/p\.m\.?/g, 'pm')
  .replace(/\s+/g, ' ').trim();

// ---------- When ----------

export function createParser(now = new Date()) {
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const at = (h, m, day) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
  const addingDays = (n, d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
  const next = d => (d > now ? d : addingDays(1, d));
  // "Tomorrow" said at 1 AM means after you sleep: later today
  const tomorrowOffset = now.getHours() < 4 ? 0 : 1;

  const isWakeUp = text => has(text.toLowerCase(), /\bwake (me )?up\b|\bwake-up\b|\balarm\b/);

  // "at 5", "5pm", "5:30", noon, midnight. A bare number isn't a time ("buy 2 apples").
  function clockTime(lower) {
    if (/\bnoon\b/.test(lower)) return { hour: 12, minute: 0, bare: false, meridiem: true };
    if (/\bmidnight\b/.test(lower)) return { hour: 0, minute: 0, bare: false, meridiem: true };
    const re = /(?:\b(at|@)\s*)?\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g;
    for (const m of lower.matchAll(re)) {
      const [whole, atWord, hourText, minuteText, meridiem] = m;
      if (!atWord && !minuteText && !meridiem) continue;
      const end = m.index + whole.length, rest = lower.slice(end);
      if (rest.startsWith('/') || lower[m.index + whole.indexOf(hourText) - 1] === '/') continue;
      // "at 18 Oak Ln", "at 4 Seasons", "7 eleven": a place, not a time
      if (!meridiem && /^\s*(?:[a-z]+\s+(?:st|ave|ln|rd|blvd|dr|way|ct|street|avenue|lane|road|drive|court)\b|(?:seasons|guys|eleven|brew|oaks|points|corners|stars?|bucks|leaves)\b)/.test(rest)) continue;
      // "in 5 min" is a countdown, not 5 o'clock
      if (/^\s*(?:min|mins|minutes|hours?|hrs?|days?|weeks?)\b/.test(rest)) continue;
      let hour = +hourText;
      const minute = minuteText ? +minuteText : 0;
      if (meridiem) {
        if (hour < 1 || hour > 12 || minute > 59) continue;
        if (meridiem === 'pm' && hour !== 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
      } else if (hour > 23 || minute > 59) continue;
      return { hour, minute, bare: !meridiem && +hourText >= 1 && +hourText < 12, meridiem: !!meridiem };
    }
    return null;
  }

  // The words around a bare "at 7" decide AM or PM
  function settledHour(time, lower, wakeUp) {
    if (!time.bare) return null;
    if (wakeUp || /\b(morning|breakfast|sunrise|alarm|leave for work|before work|commute)\b/.test(lower)) return time.hour;
    if (/\b(afternoon|evening|tonight|night|nightly|dinner|supper|party|movie|movies|drinks|concert|show|bar|club|happy hour|reservations?)\b/.test(lower)) return time.hour + 12;
    return null;
  }
  // With nothing else to go on, 1-6 is afternoon or evening and 7-11 is morning
  const usualHour = time => (time.bare && time.hour <= 6 ? time.hour + 12 : time.hour);

  // Times people say by what they're doing: "after work", "before bed", "at lunch"
  function routineHour(lower) {
    const table = [
      [/\b(after|when i get off|end of)\s+work\b|\beod\b|\bend of (the )?day\b/, 17],
      [/\b(before|at)\s+(bed|bedtime)\b|\bbedtime\b|\bbefore\s+(i\s+go\s+to\s+)?(bed|sleep|sleeping)\b/, 21],
      [/\bafter\s+lunch\b/, 13],
      [/\b(at|during|before|by|around|for|with)\s+lunch(time)?\b|\blunchtime\b|\bmidday\b/, 12],
      [/\bafter\s+dinner\b/, 19],
      [/\b(at|during|before|by|around|with|for)\s+dinner(time)?\b|\bdinnertime\b/, 18],
      [/\b(before|after|at|with|for)\s+breakfast\b/, 8],
    ];
    return table.find(([re]) => re.test(lower))?.[1] ?? null;
  }
  function partOfDayHour(lower) {
    const routine = routineHour(lower);
    if (routine !== null) return routine;
    if (/\b(nightly|at night|nights)\b/.test(lower)) return 21;
    if (lower.includes('morning')) return 9;
    if (lower.includes('afternoon')) return 13;
    if (lower.includes('evening')) return 19;
    if (/\bnight\b/.test(lower)) return 21;
    return null;
  }
  const namesPartOfDayOnItsOwn = lower => routineHour(lower) !== null || /\b(this|in the)\s+(morning|afternoon|evening)\b/.test(lower);
  const saysTomorrow = lower => lower.includes('tomorrow') || lower.includes('next day');
  const saysWeekend = lower => /this weekend|on the weekend|over the weekend|^weekend\b|\bweekend\s*[.!]*$/.test(lower);

  // A real calendar date: "10/15", "on 10-15", "nov 15", "november fifth", "the 3rd of november",
  // or a day of the month alone ("on the 15th", "Friday the 16th")
  function explicitDate(original) {
    const lower = ' ' + original.toLowerCase().replace(/24\/7/g, 'always') + ' ';
    const nextOccurrence = (month, day, year) => {
      if (year) return new Date(year < 100 ? 2000 + year : year, month - 1, day);
      let d = new Date(now.getFullYear(), month - 1, day);
      if (d < startOfDay(now)) d = new Date(now.getFullYear() + 1, month - 1, day);
      return d;
    };
    const numeric = lower.match(/(?<![\d.]\s)(?<![\d/])\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b(?!\s*(?:cups?|hours?|hrs?|miles?|lbs?|oz|tsp|tbsp|inch|inches|gallons?|pounds?|of\s+an?))/)
      || lower.match(/\b(?:on|due|by)\s+(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?\b/);
    if (numeric) {
      const first = +numeric[1], second = +numeric[2];
      const [month, day] = first > 12 && second <= 12 ? [second, first] : [first, second];
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return nextOccurrence(month, day, numeric[3] && +numeric[3]);
    }
    const monthNames = ['jan(?:uary)?', 'feb(?:ruary)?|febuary', 'mar(?:ch)?', 'apr(?:il)?', 'may', 'june?', 'july?', 'aug(?:ust)?', 'sept?(?:ember)?', 'oct(?:ober)?', 'nov(?:ember)?', 'dec(?:ember)?'];
    const ordinal = `(?:(twenty|thirty)[\\s-]?)?(${byLength(ORDINALS).join('|')})`;
    const tensOf = t => (t === 'twenty' ? 20 : t === 'thirty' ? 30 : 0);
    for (let i = 0; i < 12; i++) {
      const name = monthNames[i];
      let day = null, m;
      if ((m = lower.match(new RegExp(`\\b(?:${name})\\.?\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b(?!\\s*(?::|am|pm))`)))) day = +m[1];
      else if ((m = lower.match(new RegExp(`\\b(?:${name})\\.?\\s+(?:the\\s+)?${ordinal}\\b`)))) day = tensOf(m[1]) + ORDINALS[m[2]];
      else if ((m = lower.match(new RegExp(`\\b(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+of\\s+(?:${name})\\b`)))) day = +m[1];
      if (!day || day > 31) continue;
      const year = lower.match(/\b(20\d{2})\b/);
      return nextOccurrence(i + 1, day, year && +year[1]);
    }
    let day = null, m;
    if ((m = lower.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/) || lower.match(/\bon\s+(\d{1,2})(?:st|nd|rd|th)\b/))) day = +m[1];
    else if ((m = lower.match(new RegExp(`\\b(?:on\\s+)?the\\s+(twenty|thirty)?[\\s-]?(${Object.keys(ORDINALS).join('|')})\\b`)))) day = tensOf(m[1]) + ORDINALS[m[2]];
    if (!day || day > 31) return null;
    // "The first time…", "the second one" aren't dates; ordinals need "on" or a weekday nearby
    if (day <= 3 && !/\b(on\s+the|(sun|mon|tues|wednes|thurs|fri|satur)day\s+the|by\s+the|due\s+the)\s+(\d|first|second|third)/.test(lower)) return null;
    // This month if it hasn't passed, otherwise the next month that has that day
    for (let k = 0; k < 13; k++) {
      const d = new Date(now.getFullYear(), now.getMonth() + k, day);
      if (d.getDate() === day && d >= startOfDay(now)) return d;
    }
    return null;
  }

  // Which day the thought names, if any
  function day(lower, original) {
    const explicit = explicitDate(spokenFractionsAndOrdinals(fixedShorthand(original)));
    if (explicit) return { kind: 'on', date: explicit };
    if (lower.includes('day after tomorrow')) return { kind: 'on', date: addingDays(tomorrowOffset + 1, startOfDay(now)) };
    if (saysTomorrow(lower)) return { kind: 'on', date: addingDays(tomorrowOffset, startOfDay(now)) };
    if (lower.includes('tonight')) return { kind: 'tonight' };
    const patterns = ['sunday', 'mon(day)?', 'tue(s|sday)?', 'wed(nesday)?', 'thu(r|rs|rsday)?', 'fri(day)?', 'saturday'];
    const named = patterns.map((p, weekday) => {
      const m = lower.match(new RegExp(`\\b${p}\\b`));
      return m && { position: m.index, weekday, target: /(to|until) $/.test(lower.slice(0, m.index)) };
    }).filter(Boolean);
    // "Move Monday's meeting to Friday": the destination; otherwise the first one named
    named.sort((a, b) => (a.target !== b.target ? a.target - b.target : b.position - a.position));
    const chosen = named.at(-1);
    if (chosen) {
      const days = (chosen.weekday - now.getDay() + 7) % 7;
      if (days === 0 && /\b(every|each)\s+(other\s+)?(sun|mon|tue|wed|thu|fri|sat)/.test(lower)) return { kind: 'weekly', date: startOfDay(now) };
      return { kind: 'on', date: addingDays(days === 0 ? 7 : days, startOfDay(now)) };
    }
    if (saysWeekend(lower)) {
      if (now.getDay() === 6 && now.getHours() >= DEFAULTS.weekendHour) return { kind: 'on', date: addingDays(1, startOfDay(now)) };
      return { kind: 'weekly', date: addingDays((DEFAULTS.weekendWeekday - now.getDay() + 7) % 7, startOfDay(now)) };
    }
    if (lower.includes('next week')) {
      const toMonday = (1 - now.getDay() + 7) % 7;
      return { kind: 'on', date: addingDays(toMonday === 0 ? 7 : toMonday, startOfDay(now)) };
    }
    if (lower.includes('this week')) {
      let d = addingDays(1, startOfDay(now));
      while (d.getDay() === 0 || d.getDay() === 6) d = addingDays(1, d);
      return { kind: 'on', date: d };
    }
    return null;
  }

  function dayAndTimeDate(text) {
    const lower = normalized(text), wakeUp = isWakeUp(text);
    const d = day(lower, text), time = clockTime(lower), partOfDay = partOfDayHour(lower);

    if (d?.kind === 'tonight') {
      if (time) {
        // "Tonight at 12" is midnight, "tonight at 1" is 1 AM, "tonight at 8" is 8 PM
        if (!time.meridiem && time.hour === 12) return at(0, time.minute, addingDays(1, now));
        if (time.bare && time.hour <= 4) return at(time.hour, time.minute, addingDays(1, now));
        return next(at(time.bare ? time.hour + 12 : time.hour, time.minute, now));
      }
      const routine = routineHour(lower);
      if (routine !== null && at(routine, 0, now) > now) return at(routine, 0, now);
      for (const hour of [21, 22, 23]) if (at(hour, 0, now) > now) return at(hour, 0, now);
      return at(9, 0, addingDays(1, now));
    }

    if (d) {
      let result;
      if (time) result = at(settledHour(time, lower, wakeUp) ?? (wakeUp ? time.hour : usualHour(time)), time.minute, d.date);
      else if (partOfDay !== null) result = at(partOfDay, 0, d.date);
      else if (wakeUp) result = at(7, 0, d.date);
      else if (saysTomorrow(lower)) result = at(DEFAULTS.tomorrowHour, 0, d.date);
      else if (saysWeekend(lower)) result = at(DEFAULTS.weekendHour, 0, d.date);
      else result = at(9, 0, d.date);
      if (result > now) return result;
      return d.kind === 'weekly' ? addingDays(7, result) : null;
    }

    if (time) {
      if (wakeUp) return next(at(time.hour, time.minute, now));
      const settled = settledHour(time, lower, wakeUp);
      if (settled !== null) return next(at(settled, time.minute, now));
      if (time.bare) {
        // A bare "at 5" is the next sensible 5 o'clock
        const morning = at(time.hour, time.minute, now), evening = at(time.hour + 12, time.minute, now);
        if (time.hour >= 1 && time.hour <= 6 && evening > now && morning > now && now.getHours() < 6) return evening;
        if (morning > now) return morning;
        if (evening > now) return evening;
        return addingDays(1, time.hour >= 7 && time.hour <= 11 ? morning : evening);
      }
      return next(at(time.hour, time.minute, now));
    }

    if (wakeUp) return at(7, 0, addingDays(1, now));
    // "Pay rent today": this morning if it's still ahead, otherwise in an hour (not after 9 PM)
    if (partOfDay === null && /\btoday\b/.test(lower)) {
      const morning = at(9, 0, now);
      if (morning > now) return morning;
      const soon = new Date(+now + 3600e3);
      return soon < at(21, 0, now) ? soon : null;
    }
    if (partOfDay !== null && namesPartOfDayOnItsOwn(lower)) return next(at(partOfDay, 0, now));
    return null;
  }

  // "In 10 minutes", "in 2 1/2 hours", "in two and a half hours", "in an hour and a half", "in half
  // an hour", "in 1 hour 30 minutes", "in 20m", "timer for 25 min", "in 3 days"
  function durationText(text) {
    let t = ' ' + fixedShorthand(text).toLowerCase() + ' ';
    const replacements = [
      [/(\d+)\s*½/g, '$1.5'], [/½/g, '0.5'], [/(\d+)\s*¼/g, '$1.25'], [/(\d+)\s*¾/g, '$1.75'],
      [/(\d+)[\s-]+1\/2\b/g, '$1.5'], [/(\d+)[\s-]+1\/4\b/g, '$1.25'], [/(\d+)[\s-]+3\/4\b/g, '$1.75'],
      [/\b1\/2\b/g, '0.5'], [/-/g, ' '],
      [/\b(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs|s|sec|secs|d)\b/g, '$1 $2'],
      [/(?<!and\s)(?<!and\sa\s)\b(a\s+)?half\s+(an?\s+)?(hour|minute|day)/g, '0.5 $3'],
      [/\ba\s+couple\s+(of\s+)?/g, '2 '],
      [/\bin\s+(?:like|about|around|maybe|roughly)\s+/g, 'in '],
      [/\bafter\s+(?=(?:\d+|an?|one|two|three|half)\s+(?:hours?|hrs?|minutes?|mins?)\b)/g, 'in '],
      [/\bin\s+a\s+bit\b/g, 'in 30 minutes'],
      [/\bin\s+a\s+(?:sec|second|min)\b/g, 'in 1 minute'],
      // "check the bread in 5", "laundry to dryer in 45": minutes
      [/\bin\s+(\d{1,3})(?![\d.])(?=\s*(?:$|[,!?]|\.(?!\d)|to\b|and\b|then\b))/g, 'in $1 minutes'],
    ];
    for (const [re, to] of replacements) t = t.replace(re, to);
    return t.replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/[^a-z0-9. ]/g, ' ');
  }
  const numberWord = w => (/^\d+$/.test(w) ? +w : { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 }[w]);
  const perUnit = u => (u.startsWith('second') || ['s', 'sec', 'secs'].includes(u) ? 1 : u.startsWith('minute') || ['m', 'min', 'mins'].includes(u) ? 60
    : u.startsWith('hour') || ['h', 'hr', 'hrs'].includes(u) ? 3600 : u.startsWith('day') || u === 'd' ? 86400 : u.startsWith('week') ? 604800 : u.startsWith('month') ? 2592000 : null);
  function durationPart(words, index) {
    if (index >= words.length) return null;
    let value, j = index + 1;
    const w = words[index];
    if (/^\d+(\.\d+)?$/.test(w)) value = +w;
    else if (w === 'a' || w === 'an') value = 1;
    else if (numberWord(w) !== undefined) {
      value = numberWord(w);
      // "twenty five"
      const ones = numberWord(words[j] || '');
      if (value >= 20 && value % 10 === 0 && ones !== undefined && ones < 10) { value += ones; j++; }
    } else return null;
    const andAHalf = () => (words[j] === 'and' && words[j + 1] === 'a' && words[j + 2] === 'half' ? (j += 3, true) : false);
    if (andAHalf()) value += 0.5;
    const unit = words[j], seconds = unit && perUnit(unit);
    if (!seconds) return null;
    j++;
    if (andAHalf()) value += 0.5;
    return { seconds: value * seconds, amount: value, unit, end: j };
  }
  function timerDate(text) {
    const words = durationText(text).split(' ').filter(Boolean);
    // Things you do for a set time and want to hear when it's up: "bake cookies for 25 minutes"
    const timed = ['timer', 'alarm', 'bake', 'baking', 'nap', 'steep', 'soak', 'boil', 'roast', 'marinate', 'microwave', 'oven', 'dryer', 'charge', 'charging', 'rest', 'proof', 'rise'];
    const isTimer = words.some(w => timed.includes(w));
    for (let i = 0; i < words.length; i++) {
      const first = durationPart(words, i);
      if (!first) continue;
      const before = i > 0 ? words[i - 1] : '';
      const fromNow = words[first.end] === 'from' && words[first.end + 1] === 'now';
      // "For 2 hours" is a countdown only for a timer; "study for 2 hours tonight" is how long, not when
      if (!(before === 'in' || (before === 'for' && isTimer) || fromNow || isTimer)) continue;
      let total = first.seconds, pos = first.end, parts = 1;
      for (;;) {
        const p = durationPart(words, words[pos] === 'and' ? pos + 1 : pos);
        if (!p) break;
        total += p.seconds; pos = p.end; parts++;
      }
      // Whole days, weeks and months follow the calendar
      const u = first.unit;
      if (parts === 1 && Number.isInteger(first.amount) && (u.startsWith('day') || u === 'd' || u.startsWith('week') || u.startsWith('month'))) {
        const d = new Date(now);
        if (u.startsWith('month')) d.setMonth(d.getMonth() + first.amount);
        else d.setDate(d.getDate() + first.amount * (u.startsWith('week') ? 7 : 1));
        return d;
      }
      return new Date(+now + total * 1000);
    }
    return null;
  }

  function date(text) {
    const timer = timerDate(text);
    if (timer) return { date: timer, timer: true };
    let d = dayAndTimeDate(text);
    if (!d) return null;
    // "Pick up dry cleaning before 6": a little before the deadline, not at it
    if (/\b(?:by|before|no later than)\s+\d{1,2}(?::00)?\s*(?:am|pm)?(?=\W|$)(?!\s*(?:min|mins|minutes|hours?|days?|weeks?))/i.test(fixedShorthand(text)) && d.getMinutes() === 0) {
      const earlier = new Date(+d - 30 * 60e3);
      if (earlier > now) d = earlier;
    }
    return { date: d, timer: false };
  }

  // ---------- How often ----------
  // "every two weeks", "every morning", "every Monday at 6", "rent on the 1st of every month",
  // "MWF at 8am", "weekdays except Fridays". The label and the first time it goes off.
  function repeatRule(text) {
    const lower = normalized(text);
    const matches = re => re.test(lower);
    const numberWords = { other: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
    // "the weekly report", "a daily planner", "cancel my monthly subscription": a thing, not how often
    const notThing = '(?!\\s+(?:report|planner|digest|newsletter|summary|special|deal|budget|recap|update|reading|horoscope|vitamin|pass|schedule|meeting notes)s?\\b)';
    const notDescribing = '(?<!\\b(?:my|the|a|an|your|our|his|her|their|cancel|renew|buy|order|unsubscribe from)\\s)';
    const time = clockTime(lower), wakeUp = isWakeUp(text);
    const hourAndMinute = () => (time ? [settledHour(time, lower, wakeUp) ?? usualHour(time), time.minute] : [partOfDayHour(lower) ?? 9, 0]);
    const days = repeatedWeekdays(lower);
    if (days) {
      const [hour, minute] = hourAndMinute();
      let first = null;
      for (let i = 0; i < 8 && !first; i++) {
        const d = at(hour, minute, addingDays(i, startOfDay(now)));
        if (days.includes(d.getDay()) && d > now) first = d;
      }
      return { label: weekdaysLabel(days, matches(/\bevery\s+other\b/)), first };
    }
    let unit, interval = 1, label;
    const everyN = lower.match(/\bevery\s+(other|\d+|two|three|four|five|six|seven|ten)\s+(day|week|month)s?\b/);
    const otherWeekday = lower.match(/\bevery\s+other\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    const everyWeekday = lower.match(/\b(?:every|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    if (everyN) {
      interval = +everyN[1] || numberWords[everyN[1]] || 1;
      unit = everyN[2];
      label = everyN[1] === 'other' ? `Every other ${unit}` : `Every ${interval} ${unit}s`;
    } else if (otherWeekday) {
      unit = 'week'; label = `Every other ${otherWeekday[1][0].toUpperCase() + otherWeekday[1].slice(1)}`;
    } else if (matches(new RegExp(`\\b(every\\s+(single\\s+)?day(?!\\s+(?:is|was|feels|of|carry))|each\\s+day|(every|each)\\s+(single\\s+)?(morning|afternoon|evening|night)|nightly)\\b|${notDescribing}\\bdaily${notThing}`))
      || matches(/\beveryday\b(?=\s*($|[.,!?]|at\b|in\b|on\b|from\b|starting\b|until\b|before\b|after\b|and\b|please\b|morning|night|evening))/)) {
      unit = 'day';
      const part = lower.match(/\b(?:every|each)\s+(morning|afternoon|evening|night)\b/)?.[1] || (matches(/\bnightly\b/) ? 'night' : null);
      label = part ? `Every ${part}` : 'Every day';
    } else if (matches(new RegExp(`${notDescribing}\\bbi-?weekly${notThing}`))) {
      unit = 'week'; label = 'Every 2 weeks';
    } else if (matches(new RegExp(`\\b(every\\s+year|each\\s+year|once\\s+a\\s+year)\\b|${notDescribing}\\b(yearly|annually)`))) {
      unit = 'year'; label = 'Every year';
    } else if (matches(new RegExp(`\\b(every\\s+week|each\\s+week|once\\s+a\\s+week|(every|each)\\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\\b|${notDescribing}\\bweekly${notThing}`))) {
      unit = 'week'; label = everyWeekday ? `Every ${everyWeekday[1][0].toUpperCase() + everyWeekday[1].slice(1)}` : 'Every week';
    } else if (matches(new RegExp(`\\b(every\\s+month|each\\s+month|once\\s+a\\s+month|of\\s+(every|each)\\s+month)\\b|${notDescribing}\\bmonthly${notThing}`))) {
      unit = 'month'; label = 'Every month';
    } else return null;

    // The first time: an explicit day or time if one was given
    let first;
    const dayOfMonth = unit === 'month' && lower.match(/\b(?:on\s+)?the\s+(\d{1,2})(?:(?:st|nd|rd|th)\b|(?=\s+of\b))/);
    if (dayOfMonth && +dayOfMonth[1] >= 1 && +dayOfMonth[1] <= 31) {
      const day = +dayOfMonth[1], [hour, minute] = time ? hourAndMinute() : [9, 0];
      for (let k = 0; k < 13 && !first; k++) {
        const d = new Date(now.getFullYear(), now.getMonth() + k, day, hour, minute);
        if (d.getDate() === day && d > now) first = d;
      }
      label += ` on the ${day}${day % 100 >= 11 && day % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] || 'th'}`;
    } else if (unit === 'day' && time) {
      // "Take meds every day at 8": 8 AM every day, starting with the next one
      const [hour, minute] = hourAndMinute();
      first = next(at(hour, minute, now));
    } else {
      const partOfDay = partOfDayHour(lower);
      first = dayAndTimeDate(text) ?? next(at(partOfDay ?? 9, 0, now));
    }
    return { label, first };
  }

  return { date, repeatRule };
}

// Days named anywhere ("fridays", "sat"), for "except"; 0 = Sunday
function weekdayNames(text) {
  if (/\bweekends?\b/.test(text)) return [0, 6];
  if (/\bweekdays?\b/.test(text)) return [1, 2, 3, 4, 5];
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((n, i) => (new RegExp(`\\b${n}[a-z]*\\b`).test(text) ? i : -1)).filter(i => i >= 0);
}

// Several days that repeat: "every weekday", "weekends", "every Tue and Thu", "Mondays and
// Wednesdays", "MWF", "mon-fri", "weekdays except Fridays". Null for one day with "every"
// (that's weekly) or days that don't repeat ("move Monday's meeting to Friday").
function repeatedWeekdays(lower) {
  const except = lower.match(/\b(?:except|but not|other than|excluding|but(?=\s+(?:on\s+)?(?:sun|mon|tue|wed|thu|fri|sat|weekend)))\b/);
  if (except) {
    const head = lower.slice(0, except.index), tail = lower.slice(except.index + except[0].length);
    const everyDay = /\b(every\s+(single\s+)?day|each\s+day|daily|everyday|(every|each)\s+(morning|afternoon|evening|night)|nightly)\b/.test(head);
    const base = repeatedWeekdays(head) ?? (everyDay ? [0, 1, 2, 3, 4, 5, 6] : null);
    if (!base) return null;
    const excluded = repeatedWeekdays(tail) ?? weekdayNames(tail);
    const days = base.filter(d => !excluded.includes(d));
    return days.length === 0 || days.length === base.length ? null : days;
  }
  const has = re => re.test(lower);
  if (has(/\bmwf\b/)) return [1, 3, 5];
  if (has(/\b(tth|tuth|t\/th|tu\/th)\b/)) return [2, 4];
  const order = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const range = lower.match(/\b(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\s*(?:-|–|thru|through|to|until)\s*(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\b/);
  if (range) {
    const first = order[range[1].slice(0, 3)], last = order[range[2].slice(0, 3)];
    if (first !== last) {
      const days = [];
      for (let d = first; ; d = (d + 1) % 7) { days.push(d); if (d === last) break; }
      return days;
    }
  }
  if (has(/\b(every\s+(other\s+)?weekday|on\s+weekdays|weekdays\b(?!\s+(?:and|are|is)\b))/) && !has(/\bweekdays?\s+(only\s+)?(off|schedule|hours)\b/)) return [1, 2, 3, 4, 5];
  if (has(/\b(every\s+(other\s+)?weekend|on\s+weekends|weekends\b)/)) return [0, 6];
  const names = ['sundays?', 'mondays?|mon', 'tuesdays?|tues?', 'wednesdays?|wed', 'thursdays?|thurs?|thu', 'fridays?|fri', 'saturdays?'];
  const found = names.map((p, i) => (new RegExp(`\\b(${p})\\b`).test(lower) ? i : -1)).filter(i => i >= 0);
  if (found.length >= 2 && has(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s*\/\s*(sun|mon|tue|wed|thu|fri|sat)/)) return found;
  const plural = has(/\b(sun|mon|tues|wednes|thurs|fri|satur)days\b/) || has(/\b(sun|mon|tues|wednes|thurs|fri|satur)day\s+(nights|mornings|evenings|afternoons)\b/);
  const saysEvery = has(/\b(every|each)\s+(other\s+)?(sun|mon|tue|wed|thu|fri|sat)/);
  if (found.length >= 2 && (saysEvery || plural)) return found;
  // "practice piano monday wednesday friday at 4": three days is a schedule
  if (found.length >= 3) return found;
  if (found.length === 1 && plural && !saysEvery) return found;
  return null;
}

function weekdaysLabel(days, other) {
  const key = [...days].sort().join('');
  if (key === '12345') return 'Every weekday';
  if (key === '06') return 'Every weekend';
  const names = days.map(d => (days.length > 1 ? SHORT_DAYS[d] : WEEKDAYS[d][0].toUpperCase() + WEEKDAYS[d].slice(1)));
  return `Every ${other ? 'other ' : ''}${names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names.at(-1) : names[0]}`;
}

// ---------- Where ----------

const COMMON_VERBS = ['call', 'study', 'buy', 'get', 'make', 'do', 'go', 'see', 'send', 'pick', 'take', 'bring', 'finish', 'start', 'check', 'ask', 'tell', 'text', 'email', 'pay', 'read', 'write', 'clean', 'book', 'order', 'print', 'look', 'sign', 'cancel', 'return', 'visit', 'meet', 'talk', 'work', 'practice', 'submit', 'turn', 'drop', 'grab', 'remember', 'remind', 'be', 'have', 'help', 'fix', 'find', 'move', 'wash', 'weigh', 'refill', 'renew'];

// "When I get home" or "next time I'm at Costco"
export function placeName(text) {
  const lower = fixedShorthand(text).toLowerCase();
  if (/\b(get|i'm|i am|im) home\b/.test(lower) || /\b(?:when|once|after) i (?:get|am|'m) back home\b/.test(lower)) return 'Home';
  const patterns = [
    /(?:the )?next time (?:i(?: am|'m)|im) (?:at|near|in) (?:the |a |an )?([a-z0-9 .&'-]+)/i,
    /(?:when|once|as soon as) (?:i(?: am|'m)|im) (?:at|near|in) (?:the |a |an )?([a-z0-9 .&'-]+)/i,
    /when i (?:get|arrive|go) (?:to|at) (?:the |a |an )?([a-z0-9 .&'-]+)/i,
    /(?:the )?next time (?:i go|i get) (?:to) (?:the |a |an )?([a-z0-9 .&'-]+)/i,
  ];
  const stops = new Set([...COMMON_VERBS, 'tomorrow', 'tonight', 'today', 'on', 'at', 'to', 'and', 'then', 'so', 'i', 'remind', 'please', 'for', 'with', 'by', 'this', 'next', 'after', 'before', 'pick', 'get']);
  const source = fixedShorthand(text);
  for (const re of patterns) {
    const m = source.match(re);
    if (!m) continue;
    const words = [];
    for (const word of m[1].split(' ')) {
      const bare = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
      if (!bare || stops.has(bare) || words.length === 4) break;
      words.push(word);
      if (/[,.;:!?]$/.test(word)) break;
    }
    const name = words.join(' ').replace(/[\s.,;:!?]+$/, '');
    if (name) return name.replace(/\b[a-z]/g, c => c.toUpperCase()).replace(/'S\b/g, "'s");
  }
  return null;
}

// A place named in passing, after "at", "near" or "from" ("buy eggs at trader joes" → Trader Joes),
// which the app offers as a one-tap "At Trader Joes" reminder. Times and "look at" aren't places.
export function mentionedPlace(text) {
  const explicit = placeName(text);
  if (explicit) return explicit;
  const re = /\b(look|stare|laugh|smile|yell|glance|aim|point|good|bad|great|arrive)?\s*\b(?:at|near|from)\s+(?:(?:the|a|an)\s+)?([a-z0-9][a-z0-9'’&.-]*(?:\s+[a-z0-9'’&.-]+){0,3})/gi;
  const stopWords = new Set(['tomorrow', 'tonight', 'today', 'on', 'by', 'for', 'before', 'after', 'when', 'and', 'to', 'this', 'next', 'every', 'in', 'around', 'with', 'so', 'then', 'later']);
  const notPlaces = new Set(['noon', 'midnight', 'night', 'lunch', 'dinner', 'breakfast', 'least', 'all', 'once', 'first', 'last', 'some', 'home', 'it', 'that', 'this', 'me', 'him', 'her', 'them', 'us', 'you', 'work', 'school', 'the', 'a', 'an']);
  for (const m of text.matchAll(re)) {
    if (m[1]) continue;
    const words = [];
    for (const word of m[2].split(' ')) { if (stopWords.has(word.toLowerCase())) break; words.push(word); }
    const first = words[0]?.toLowerCase();
    if (!first || notPlaces.has(first) || /^\d/.test(first) || createParser().date('at ' + words.join(' '))) continue;
    return words.map(w => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
  }
  return null;
}

// ---------- Title ----------
// Turns what someone said ("Remind me to buy batteries the next time I'm at Costco") into a short
// title ("Buy batteries"); the time and place show separately.

const FILLER = "hey|hi|yo|ok|okay|pleas+e*|pls|plz|so+|um+|uh+|ugh+|oh|and|also|bruh|bro|dude|yeah|like|lol|ngl|tbh|fr|smh|omg+|lowkey|highkey|alright|ight|siri|hey siri";
const OPENINGS = new RegExp(`^(?:(?:${FILLER})[,!.]?\\s+)*(?:(?:can (?:you|u)\\s+|could (?:you|u)\\s+)?remind me(?: to| for| about)?|remember me(?: to)?|remember to|(?:don'?t|dont|do not) (?:let me )?forget(?: to| about)?|before i forget|(?:u|you) (?:gotta|need to|have to)|need 2|(?:i\\s+)?(?:tryna|wanna|gonna)|don'?t forget to|make sure (?:to|i)|note to self[:,]?|(?:i\\s+)?(?:need|have|got) to|i should|(?:i\\s+)?gotta|i want to|set (?:a )?reminder (?:to|for)|reminder(?: to)?[:,]?)\\s+`, 'i');
const FILLERS = new RegExp(`^(?:(?:${FILLER}|no cap|deadass|basically|honestly|literally|idk|ok so)[,!.]?\\s+)+`, 'i');
const DOING = "\\b(?:buy|get|grab|pick|return|drop|order|ask|check|print|mail|send|call|text|pay|look|find|try|bring|fill|refill|renew|cancel|use|make|do|see|give|take|put|weigh|preheat|feed|water|start|turn|move|clean|(?<!car\\s)wash|charge|eat|drink|stretch|meditate|tell|remind|book|sign|submit|leave|unlock|lock|plug|unplug|set|stop|ice|hit|finish|register|deposit|venmo|email|reply|apply|reschedule|go|wear|change|fix|cook|study|read|write|post|upload|measure|vacuum)\\b";

// Drops a place clause at the start ("Next time I'm at the gym", "At Trader Joe's", "Once I'm home")
function removingLeadingPlace(title, original) {
  const fromVerb = rest => {
    const verb = rest.match(new RegExp(DOING, 'i'));
    if (!verb || verb.index === 0) return null;
    return rest.slice(0, verb.index).replace(/^[ ,:]+|[ ,:]+$/g, '').split(' ').length <= 5 ? rest.slice(verb.index) : null;
  };
  const home = title.match(/^(?:when|once|after|as soon as)\s+i\s*(?:get|am|'m|m|arrive)\s+(?:back\s+|close to\s+|near\s+|to\s+|at\s+)?home\b[,\s]*/i);
  if (home) return title.slice(home[0].length);
  const clause = title.match(/^(?:when|once|after|as soon as)\s+i\s+(?:leave|get off|finish|am done with)\s+|^(?:before|after|when|once)\s+i\s+(?:leave|walk in|walk into|get to|go to)\s+(?:the\s+)?[\w']+(?:\s+[\w']+)?\s+|^(?:pulling into|on my way to|on the way to|on my way|on the way|heading to)\s+/i);
  if (clause) { const after = fromVerb(title.slice(clause[0].length)); if (after) return after; }
  const lead = title.match(/^(?:(?:the\s+)?next\s+time\s+(?:i'?m|i am|im|i go|i get)\s+(?:to\s+|at\s+|in\s+|near\s+)?|(?:when|whenever|once)\s+(?:i'?m|i am|im|i get to|i go to|i get close to)\s+(?:at\s+|near\s+|in\s+)?|next\s+time\s+at\s+|near\s+|at\s+|@\s*)(?:the\s+|a\s+|an\s+)?/i);
  if (!lead) return title;
  const rest = title.slice(lead[0].length);
  const after = fromVerb(rest);
  if (after) return after;
  for (const place of [placeName(original), mentionedPlace(original)].filter(Boolean)) {
    const m = rest.match(new RegExp('^' + place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "'?") + '(?=[\\s,]|$)[,\\s]*', 'i'));
    if (m && rest.slice(m[0].length)) return rest.slice(m[0].length);
  }
  const word = rest.match(/^(?:home|work|school|the gym|gym|the store|class)\b[,\s]*/i);
  if (word && rest.slice(word[0].length)) return rest.slice(word[0].length);
  return title;
}

const NUM = "(?:\\d+(?:\\.\\d+)?(?:[\\s-]+[13]/[24]|\\s*[½¼¾])?|[½¼¾]|(?:twenty|thirty|forty|fifty)\\s+(?:one|two|three|four|five|six|seven|eight|nine)|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|half an?|a couple of|a couple|a few)(?:\\s+and\\s+a\\s+half)?";
const WD = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MO = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';
const PARTS = 'morning|afternoon|evening|night';
const DN = '(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|thurs|fri|sat(?:ur)?)(?:day)?s?';
const ORD = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth';
const WHEN_WHERE = [
  `\\s*\\b(?:every|each)\\s+(?:other\\s+)?(?:${WD})s?(?:\\s+(?:${PARTS}))?\\b`,
  '\\s*\\b(?:the\\s+)?day after (?:tomorrow|tmrw)\\b',
  '\\s*\\b\\d+\\s+times\\s+a\\s+(?:day|week|month)\\b',
  '\\s*\\bof\\s+the\\s+(?:morning|afternoon|evening)\\b',
  '\\s+in\\s+(?:like|about|around|maybe)\\s+\\d+(?:\\s*(?:mins?|minutes?|hrs?|hours?))?\\b',
  '\\s+in\\s+\\d{1,3}(?=\\s*$)',
  '\\s+in\\s+a\\s+(?:bit|sec|second|min)\\b',
  '^(?:after|in)\\s+(?:like\\s+)?\\d+\\s*(?:mins?|minutes?|hrs?|hours?)\\s+',
  '(?<=\\b(?:nap|rest|bake|boil|steep|soak|timer))\\s+\\d+\\s*(?:mins?|minutes?)\\b',
  `\\s*\\bevery\\s+(?:\\d+(?:st|nd|rd|th)|first|second|third|fourth|last)\\s+${DN}\\b`,
  '\\s*\\bevery\\s+(?:sat|sun)\\b',
  '\\s*\\bevery\\s+\\d{1,2}(?:st|nd|rd|th)\\b',
  '\\s*\\b(?:twice|three times|once)\\s+a\\s+(?:day|week|month)\\b',
  '\\s*\\bevery\\s+\\d+\\s+(?:hours|minutes)\\b',
  '\\s*\\bhourly\\b',
  '\\s*\\bfor the next \\d+ (?:days|weeks)\\b',
  `\\s*\\b${DN}\\s*(?:-|–|thru|through|to|until)\\s*${DN}\\b`,
  '\\s*\\b(?:mwf|tth|tuth)\\b',
  `\\s*\\b(?:except|but not|other than)\\s+(?:on\\s+)?(?:${DN}|weekends?|weekdays?)(?:\\s*(?:,|and|&)\\s*${DN})*\\b`,
  '\\s*\\bbetween\\s+\\d{1,2}(?::\\d\\d)?(?:\\s*(?:am|pm))?\\s+and\\s+\\d{1,2}(?::\\d\\d)?(?:\\s*(?:am|pm))?\\b',
  '\\s*\\b\\d{1,2}(?::\\d\\d)?\\s*(?:-|–)\\s*\\d{1,2}(?::\\d\\d)?\\s*(?:am|pm)\\b',
  `\\s*\\b(?:on\\s+|by\\s+|before\\s+)?(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th)?\\s+of\\s+(?:${MO})[a-z]*\\b`,
  `\\s*\\b(?:on\\s+|by\\s+|before\\s+)?(?:${MO})[a-z]*\\.?\\s+(?:the\\s+)?(?:(?:twenty|thirty)[\\s-]?)?(?:${ORD})\\b`,
  '\\s*\\b(?:tmrw|tmr|2moro|2morrow|tomoro|tomorow|tommorow|tonite|2nite|wknd|later today|first thing(?: in the morning)?|next month|this month|end of (?:the )?(?:week|month))\\b',
  '\\s+in\\s+\\d+(?:\\.\\d+)?\\s*(?:m|min|mins|h|hr|hrs)\\b',
  '\\s*\\b(?:(?:every\\s+(?:other\\s+)?|each\\s+|on\\s+)(?:weekday|weekend)s?|weekdays|weekends)\\b',
  '^weekend[:,]?\\s+',
  `\\s*\\b(?:every\\s+(?:other\\s+)?|each\\s+|on\\s+)${DN}(?:(?:\\s*(?:,|and|&)\\s*|\\s+)(?:and\\s+)?${DN})+\\b`,
  '\\s*\\b(?:sun|mon|tues|wednes|thurs|fri|satur)days(?:\\s*(?:,|and|&)\\s*(?:and\\s+)?(?:sun|mon|tues|wednes|thurs|fri|satur)days)*\\b',
  '\\s*\\b(?:every\\s+single\\s+day|nightly)\\b',
  `\\s*\\b(?:every|each)\\s+(?:other\\s+)?${DN}(?:\\s+(?:night|nite|morning|evening|afternoon))?\\b`,
  '\\s*\\beach\\s+(?:morning|afternoon|evening|night|day)\\b',
  '\\s*\\b(?:(?:right\\s+)?after work|when i get off work|end of (?:the )?day|eod|before bed(?:time)?|at bedtime|before (?:sleep|sleeping)|before i go to (?:bed|sleep)|(?:at|during|before|after|by|around|with) (?:lunch|dinner|breakfast)(?:time)?)\\b',
  '\\s*\\bthe\\s+\\d{1,2}\\s+of\\s+(?:every|each)\\s+month\\b',
  '\\s+(?:in|before|by|after|until)\\s+(?:early\\s+|late\\s+|mid\\s+)?(?:january|february|march|april|june|july|august|september|october|november|december)\\b',
  "\\s+@\\s*[\\w']+(?:\\s+[\\w']+)?$",
  '[,]?\\s+when (?:i|he|she|they) (?:get|gets|arrive|arrives|walk|go) (?:to|in|into|home|back)\\b.*$',
  `\\s*\\b(?:on\\s+|by\\s+)?the\\s+(?:(?:twenty|thirty)[\\s-]?)?(?:${ORD})\\b(?!\\s+(?:time|one|place|step|thing|day of))`,
  '\\s*\\b(?:on|by)\\s+\\d{1,2}-\\d{1,2}(?:-\\d{2,4})?\\b',
  "(?<=\\S)[,]?\\s+(?:the\\s+)?next time (?:i'?m|i am|im|i'?m at|i go to|i get to) .*$",
  "(?<=\\S)[,]?\\s+when (?:i'?m|i am|im|i get to|i go to) (?:at|near) .*$",
  "[,]?\\s*(?:when|once|after) i (?:get|am|'m) (?:back )?home\\b",
  "[,]?\\s*when i'?m home\\b",
  `^(?:in|for)\\s+(?:${NUM})\\s+(?:second|sec|minute|min|hour|hr|day|week|month)s?(?:\\s+and\\s+a\\s+half)?(?:\\s+(?:and\\s+)?\\d+\\s+(?:minute|min)s?)?(?:\\s+from now)?\\s+(?:to\\s+)?`,
  `\\s+(?:in|for)\\s+(?:${NUM})\\s+(?:second|sec|minute|min|hour|hr|day|week|month)s?(?:\\s+and\\s+a\\s+half)?(?:\\s+(?:and\\s+)?\\d+\\s+(?:minute|min)s?)?(?:\\s+from now)?\\b`,
  `\\s+(?:${NUM})\\s+(?:minute|hour|day|week|month)s?\\s+from now\\b`,
  `\\s*\\b(?:tonight|today|tomorrow(?:\\s+(?:${PARTS}))?|the next day|this (?:${PARTS}|weekend|week)|later this week|next week|on the weekend|over the weekend)\\b`,
  `(?<!about)(?<!abt)(?<!about\\s)(?<!abt\\s)\\s*\\b(?:on\\s+|next\\s+|this\\s+)?(?:${WD}|tues|thurs|thur|thu|fri|wed|mon)(?:\\s+(?:${PARTS}))?\\b`,
  `\\s*\\b(?:on\\s+)?(?:${MO})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`,
  '\\s*\\b(?:on\\s+)?(?!24/7)\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b',
  '\\s*\\b\\d{1,2}(?::\\d{2})?\\s*(?:am|pm|a\\.m\\.?|p\\.m\\.?)(?=\\W|$)',
  `\\s*\\b(?:in the\\s+)(?:${PARTS})\\b`,
  '\\s*\\b(?:on\\s+)?the\\s+\\d{1,2}(?:st|nd|rd|th)(?:\\s+of\\s+(?:every|each|the)\\s+month)?\\b',
  '\\s*\\bof\\s+(?:every|each|the)\\s+month\\b',
  '\\s*\\bevery\\s+(?:other|\\d+|two|three|four|five|six|seven|ten)\\s+(?:day|week|month)s?\\b',
  `\\s*\\b(?:every\\s+(?:day(?!\\s+(?:is|was|carry))|week|month|year|${PARTS}|${WD})|each month|once a (?:week|month|year))\\b`,
].map(p => new RegExp(p, 'gi'));

const saysClockTime = text => /\bnoon\b|\bmidnight\b|(?:\b(?:at|@)\s*)\d{1,4}\b|\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(fixedShorthand(text));

export function quickTitle(text) {
  let title = fixedShorthand(text.trim());
  const original = title;
  title = title.replace(FILLERS, '').replace(OPENINGS, '')
    .replace(/^(?:i\s+)?(?:forgot to|need to|have to|gotta)\s+/i, '')
    // "remind grace n sam to …"
    .replace(/^remind\s+[a-z']+(?:(?:\s*(?:,|and|n|&|\+)\s*|\s+)[a-z']+)*?\s+(?:to|about)\s+/i, '')
    // List headers: "costco: oat milk, eggs", "target run: shampoo"
    .replace(/^(?:(?!idea\b|note\b|todo\b|reminder\b)[\w']+(?:\s+[\w']+)?(?:\s+run)?\s*:|[\w']+(?:\s+[\w']+)?\s+run\s*[-–]|next\s+[\w']+(?:\s+[\w']+)?\s+run|(?:[\w']+\s+){0,2}[\w']+\s*(?:->|→))\s+/i, '')
    .replace(/(?:[,.]?\s+(?:please|pls|plz|thanks|thx|ty|tysm|thank you|asap|lol|rn|right now|or else|or smth|or something|or whatever|k|kk|ok|okay|sometime|(?<!days\s)later))+[.!]*$/i, '');
  title = removingLeadingPlace(title, original);
  if (saysClockTime(original)) {
    title = title.replace(/\s*(?:\b(?:at|by|around|about|before|until|till|no later than)\s+|@\s*)(?:[01]\d[0-5]\d|2[0-3][0-5]\d|\d{1,2}(?:(?::|\s|\.)[0-5]\d)?)\s*(?:o\s?'?clock|am|pm|a\.m\.?|p\.m\.?)?(?:\s+and\s+\d{3,4})?(?=\W|$)(?!\s+(?:seasons|guys|eleven|brew|oaks|points|corners|stars?|bucks|leaves)\b)(?!\s+[a-z]+\s+(?:st|ave|ln|rd|blvd|dr|way|ct)\b)/gi, '');
  }
  const words = t => t.split(' ').filter(Boolean).length;
  for (const re of WHEN_WHERE) {
    const next = title.replace(re, '');
    if (re.source.includes('.*$') && words(next) < 2 && words(title) >= 3) continue;
    title = next;
  }
  title = title.replace(/\s*\b(?:at|by|around)?\s*(?:noon|midnight)\b/gi, '');
  if (saysClockTime(original)) title = title.replace(/(?<!\bthe)\s+\d{1,2}:[0-5]\d\b/gi, '');
  if (createParser().repeatRule(original)) title = title.replace(/\s*\b(?:everyday|daily|weekly|bi-?weekly|monthly|yearly|annually)\b/gi, '');
  title = title.replace(/\s*\(\s*\)/g, '');
  const withoutPlace = title.replace(/\s+(?:at|to)\s+(?:work|home|school|the gym|the office)[.!]*$/i, '');
  if (words(withoutPlace) >= 3) title = withoutPlace;
  title = title
    .replace(/\s+(?:before|after)\s+(?:(?:the|my|our)\s+)?(?:[\w']+\s){0,3}?(?:appointment|appt|party|class|meeting|practice|game|shift|exam|test|interview|lecture|flight|trip|wedding|concert|standup)\b/gi, '')
    .replace(/\s+(?:before|after)\s+[A-Za-z]{2,4}\s?\d{3,4}\b/g, '')
    .replace(OPENINGS, '')
    .replace(/^\s*(?:to|for)\s+(?=(?:buy|get|grab|call|text|pick|go|take|make|do|send|pay|clean|book|check|bring|find|order|email|finish|start|wash|water|feed)\b)/i, '')
    .replace(/^\s*to\s+/i, '');
  // The store at the end ("…from Costco", "…at Target") shows under the title already
  const place = mentionedPlace(title);
  if (place) {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const buying = /^(?:buy|get|grab|order|purchase|pick up some|shop for)\b/i.test(title);
    const preps = buying && !/\d/.test(place) ? 'at|from' : 'at';
    const withoutStore = title.replace(new RegExp(`\\s+(?:${preps})\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}[\\s.!]*$`, 'i'), '');
    if (words(withoutStore) >= 2) title = withoutStore;
  }
  title = title
    .replace(/\s{2,}/g, ' ')
    .replace(/(?:[\s,;:.!-]+|\s+(?:at|on|by|the|to|and|for|before|until|till|from|for my|my)|(?<!weigh|check|log|sign|plug|turn|drop|hand|fill|clock|move|walk|come|sleep|break)\s+in)+$/i, '')
    .trim()
    .replace(/^[,.;:\-–]+\s*/, '')
    .replace(/[,.;:!?\-–]+$/, '');
  if (title.length < 2) return original;
  return title[0].toUpperCase() + title.slice(1);
}

// ---------- Everything together ----------

export function parseThought(text, now = new Date()) {
  const parser = createParser(now);
  const repeat = parser.repeatRule(text);
  const when = repeat?.first ? { date: repeat.first, timer: false } : parser.date(text);
  const place = placeName(text);
  return { title: quickTitle(text), when, repeat: repeat?.label ?? null, place, nearby: place ? null : mentionedPlace(text) };
}
