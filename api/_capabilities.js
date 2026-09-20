const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function string(value, label, { optional = false, max = 500 } = {}) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} is invalid`);
  return value.trim();
}

function iso(value, label) {
  const result = string(value, label, { max: 64 });
  if (!ISO_DATE.test(result) || Number.isNaN(Date.parse(result))) throw new Error(`${label} must be ISO 8601`);
  return result;
}

function rejectUnknown(input, allowed, label) {
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} has unknown arguments: ${unknown.join(', ')}`);
}

const CAPABILITY_CATALOG = {
  'system.calendar.createEvent': {
    descriptor: {
      id: 'system.calendar.createEvent', title: 'Create calendar event', risk: 'write',
      executor: 'device', confirmation: 'once_per_plan', scopes: ['calendar.write'],
      description: 'Create one calendar event after confirmation.',
      inputDescription: '{ title, startDate ISO, endDate ISO, optional location, notes, timeZone }',
    },
    validate(raw) {
      const input = object(raw, 'calendar input');
      rejectUnknown(input, ['title', 'startDate', 'endDate', 'location', 'notes', 'timeZone'], 'calendar input');
      const startDate = iso(input.startDate, 'startDate');
      const endDate = iso(input.endDate, 'endDate');
      if (Date.parse(endDate) <= Date.parse(startDate)) throw new Error('endDate must follow startDate');
      return {
        title: string(input.title, 'title', { max: 160 }), startDate, endDate,
        ...(input.location === undefined ? {} : { location: string(input.location, 'location', { max: 500 }) }),
        ...(input.notes === undefined ? {} : { notes: string(input.notes, 'notes', { max: 2000 }) }),
        ...(input.timeZone === undefined ? {} : { timeZone: string(input.timeZone, 'timeZone', { max: 80 }) }),
      };
    },
  },
  'maps.route.estimate': {
    descriptor: {
      id: 'maps.route.estimate', title: 'Estimate transit route', risk: 'read',
      executor: 'server', confirmation: 'once_per_plan', scopes: ['location.route'],
      description: 'Estimate a transit route for an explicit origin, destination, and arrival time.',
      inputDescription: '{ origin, destination, arriveBy ISO, optional arrivalMinutesEarly 0..180 }',
    },
    validate(raw) {
      const input = object(raw, 'route input');
      rejectUnknown(input, ['origin', 'destination', 'arriveBy', 'arrivalMinutesEarly'], 'route input');
      const early = input.arrivalMinutesEarly === undefined ? 0 : input.arrivalMinutesEarly;
      if (!Number.isInteger(early) || early < 0 || early > 180) throw new Error('arrivalMinutesEarly is invalid');
      return {
        origin: string(input.origin, 'origin', { max: 500 }),
        destination: string(input.destination, 'destination', { max: 500 }),
        arriveBy: iso(input.arriveBy, 'arriveBy'),
        arrivalMinutesEarly: early,
      };
    },
  },
  'system.reminder.schedule': {
    descriptor: {
      id: 'system.reminder.schedule', title: 'Schedule preparation reminders', risk: 'write',
      executor: 'device', confirmation: 'once_per_plan', scopes: ['notifications.schedule'],
      description: 'Schedule preparation and departure notifications after any route dependency.',
      inputDescription: '{ eventStartsAt ISO, preparation string[], optional preparationMinutesBeforeDeparture 1..1440 }',
    },
    validate(raw) {
      const input = object(raw, 'reminder input');
      rejectUnknown(input, ['eventStartsAt', 'preparation', 'preparationMinutesBeforeDeparture'], 'reminder input');
      if (!Array.isArray(input.preparation) || input.preparation.length > 20 || input.preparation.some((item) => typeof item !== 'string' || item.length > 300)) {
        throw new Error('preparation is invalid');
      }
      const lead = input.preparationMinutesBeforeDeparture === undefined ? 30 : input.preparationMinutesBeforeDeparture;
      if (!Number.isInteger(lead) || lead < 1 || lead > 1440) throw new Error('preparationMinutesBeforeDeparture is invalid');
      return { eventStartsAt: iso(input.eventStartsAt, 'eventStartsAt'), preparation: input.preparation, preparationMinutesBeforeDeparture: lead };
    },
  },
};

function publicCapabilityCatalog() {
  return Object.values(CAPABILITY_CATALOG).map(({ descriptor }) => descriptor);
}

function validateCapabilityInput(capabilityId, input) {
  const capability = CAPABILITY_CATALOG[capabilityId];
  if (!capability) throw new Error(`Capability is not registered: ${capabilityId}`);
  return { descriptor: capability.descriptor, input: capability.validate(input) };
}

module.exports = { CAPABILITY_CATALOG, publicCapabilityCatalog, validateCapabilityInput };
