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

function iso(value, label, { optional = false } = {}) {
  if (optional && value === undefined) return undefined;
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
    inputKeys: ['title', 'startDate', 'endDate', 'location', 'notes', 'timeZone'],
    descriptor: {
      id: 'system.calendar.createEvent', title: 'Create calendar event', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['calendar.write'],
      description: 'Create one calendar event after confirmation.',
      inputDescription: '{ title, startDate ISO, endDate ISO, optional location, notes, timeZone }',
    },
    validate(raw, deferred = new Set()) {
      const input = object(raw, 'calendar input');
      rejectUnknown(input, ['title', 'startDate', 'endDate', 'location', 'notes', 'timeZone'], 'calendar input');
      const startDate = iso(input.startDate, 'startDate', { optional: deferred.has('startDate') });
      const endDate = iso(input.endDate, 'endDate', { optional: deferred.has('endDate') });
      if (startDate && endDate && Date.parse(endDate) <= Date.parse(startDate)) throw new Error('endDate must follow startDate');
      return {
        ...(deferred.has('title') && input.title === undefined ? {} : { title: string(input.title, 'title', { max: 160 }) }),
        ...(startDate === undefined ? {} : { startDate }), ...(endDate === undefined ? {} : { endDate }),
        ...(input.location === undefined ? {} : { location: string(input.location, 'location', { max: 500 }) }),
        ...(input.notes === undefined ? {} : { notes: string(input.notes, 'notes', { max: 2000 }) }),
        ...(input.timeZone === undefined ? {} : { timeZone: string(input.timeZone, 'timeZone', { max: 80 }) }),
      };
    },
  },
  'maps.route.estimate': {
    inputKeys: ['origin', 'destination', 'arriveBy', 'arrivalMinutesEarly'],
    descriptor: {
      id: 'maps.route.estimate', title: 'Estimate transit route', risk: 'read',
      executor: 'server', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['location.route'],
      description: 'Estimate a transit route for an explicit origin, destination, and arrival time.',
      inputDescription: '{ origin, destination, arriveBy ISO, optional arrivalMinutesEarly 0..180 }',
    },
    validate(raw, deferred = new Set()) {
      const input = object(raw, 'route input');
      rejectUnknown(input, ['origin', 'destination', 'arriveBy', 'arrivalMinutesEarly'], 'route input');
      const early = input.arrivalMinutesEarly === undefined ? 0 : input.arrivalMinutesEarly;
      if (!Number.isInteger(early) || early < 0 || early > 180) throw new Error('arrivalMinutesEarly is invalid');
      return {
        ...(deferred.has('origin') && input.origin === undefined ? {} : { origin: string(input.origin, 'origin', { max: 500 }) }),
        ...(deferred.has('destination') && input.destination === undefined ? {} : { destination: string(input.destination, 'destination', { max: 500 }) }),
        ...(deferred.has('arriveBy') && input.arriveBy === undefined ? {} : { arriveBy: iso(input.arriveBy, 'arriveBy') }),
        arrivalMinutesEarly: early,
      };
    },
  },
  'system.reminder.schedule': {
    inputKeys: ['eventStartsAt', 'preparation', 'preparationMinutesBeforeDeparture'],
    descriptor: {
      id: 'system.reminder.schedule', title: 'Schedule preparation reminders', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['notifications.schedule'],
      description: 'Schedule preparation and departure notifications after any route dependency.',
      inputDescription: '{ eventStartsAt ISO, preparation string[], optional preparationMinutesBeforeDeparture 1..1440 }',
    },
    validate(raw, deferred = new Set()) {
      const input = object(raw, 'reminder input');
      rejectUnknown(input, ['eventStartsAt', 'preparation', 'preparationMinutesBeforeDeparture'], 'reminder input');
      if (!(deferred.has('preparation') && input.preparation === undefined)
        && (!Array.isArray(input.preparation) || input.preparation.length > 20 || input.preparation.some((item) => typeof item !== 'string' || item.length > 300))) {
        throw new Error('preparation is invalid');
      }
      const lead = input.preparationMinutesBeforeDeparture === undefined ? 30 : input.preparationMinutesBeforeDeparture;
      if (!Number.isInteger(lead) || lead < 1 || lead > 1440) throw new Error('preparationMinutesBeforeDeparture is invalid');
      return {
        ...(deferred.has('eventStartsAt') && input.eventStartsAt === undefined ? {} : { eventStartsAt: iso(input.eventStartsAt, 'eventStartsAt') }),
        ...(input.preparation === undefined ? {} : { preparation: input.preparation }), preparationMinutesBeforeDeparture: lead,
      };
    },
  },
  'taskspace.notes.create': {
    inputKeys: ['title', 'content', 'tags'],
    descriptor: {
      id: 'taskspace.notes.create', title: 'Save a Taskspace note', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['taskspace.notes.write'],
      description: 'Persist a note inside Taskspace. This does not write to Apple Notes or another external app.',
      inputDescription: '{ title, content, optional tags string[] }',
    },
    validate(raw) {
      const input = object(raw, 'note input');
      rejectUnknown(input, ['title', 'content', 'tags'], 'note input');
      if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > 20
        || input.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 80))) {
        throw new Error('tags are invalid');
      }
      return {
        title: string(input.title, 'title', { max: 160 }),
        content: string(input.content, 'content', { max: 12000 }),
        ...(input.tags === undefined ? {} : { tags: input.tags.map((tag) => tag.trim()) }),
      };
    },
  },
  'taskspace.messaging.createDraft': {
    inputKeys: ['recipient', 'channel', 'subject', 'body'],
    descriptor: {
      id: 'taskspace.messaging.createDraft', title: 'Create a Taskspace message draft', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['taskspace.messaging.draft.write'],
      description: 'Persist a message draft inside Taskspace without sending it to any recipient.',
      inputDescription: '{ body, optional recipient, channel, subject }',
    },
    validate(raw) {
      const input = object(raw, 'message draft input');
      rejectUnknown(input, ['recipient', 'channel', 'subject', 'body'], 'message draft input');
      return {
        body: string(input.body, 'body', { max: 12000 }),
        ...(input.recipient === undefined ? {} : { recipient: string(input.recipient, 'recipient', { max: 300 }) }),
        ...(input.channel === undefined ? {} : { channel: string(input.channel, 'channel', { max: 80 }) }),
        ...(input.subject === undefined ? {} : { subject: string(input.subject, 'subject', { max: 160 }) }),
      };
    },
  },
  'taskspace.messaging.approvalDemo': {
    inputKeys: ['recipient', 'body'],
    descriptor: {
      id: 'taskspace.messaging.approvalDemo', title: 'Demonstrate approval for an external send', risk: 'external-action',
      executor: 'device', interactionMode: 'structured', confirmation: 'always', scopes: ['taskspace.messaging.approval-demo'],
      description: 'Safe reference action for testing per-attempt approval. It records approval but never sends a message.',
      inputDescription: '{ recipient, body }. Use only when the user explicitly asks to test or demonstrate high-risk send approval.',
    },
    validate(raw) {
      const input = object(raw, 'approval demo input');
      rejectUnknown(input, ['recipient', 'body'], 'approval demo input');
      return {
        recipient: string(input.recipient, 'recipient', { max: 300 }),
        body: string(input.body, 'body', { max: 2000 }),
      };
    },
  },
  'taskspace.preferences.set': {
    inputKeys: ['key', 'value', 'category'],
    descriptor: {
      id: 'taskspace.preferences.set', title: 'Save an explicit user preference', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['taskspace.preferences.write'],
      description: 'Persist only a preference explicitly stated by the user. Never infer or silently learn a preference.',
      inputDescription: '{ key, value, optional category }',
    },
    validate(raw) {
      const input = object(raw, 'preference input');
      rejectUnknown(input, ['key', 'value', 'category'], 'preference input');
      return {
        key: string(input.key, 'key', { max: 100 }), value: string(input.value, 'value', { max: 500 }),
        ...(input.category === undefined ? {} : { category: string(input.category, 'category', { max: 100 }) }),
      };
    },
  },
  'files.document.read': {
    inputKeys: ['acceptedTypes', 'maxBytes'],
    descriptor: {
      id: 'files.document.read', title: 'Read a user-selected text document', risk: 'read',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['files.read.user-selected'],
      description: 'Ask the user to choose a real text document, then read its contents. The file picker is shown during execution.',
      inputDescription: '{ optional acceptedTypes string[], optional maxBytes 1..200000 }',
    },
    validate(raw) {
      const input = object(raw, 'file read input');
      rejectUnknown(input, ['acceptedTypes', 'maxBytes'], 'file read input');
      const supportedTypes = new Set(['text/plain', 'text/markdown', 'application/json', 'text/csv']);
      if (input.acceptedTypes !== undefined && (!Array.isArray(input.acceptedTypes) || input.acceptedTypes.length > 12
        || input.acceptedTypes.some((type) => typeof type !== 'string' || !supportedTypes.has(type)))) {
        throw new Error('acceptedTypes are invalid');
      }
      const maxBytes = input.maxBytes === undefined ? 200000 : input.maxBytes;
      if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 200000) throw new Error('maxBytes is invalid');
      return { ...(input.acceptedTypes === undefined ? {} : { acceptedTypes: input.acceptedTypes }), maxBytes };
    },
  },
  'files.document.create': {
    inputKeys: ['fileName', 'content', 'mimeType'],
    descriptor: {
      id: 'files.document.create', title: 'Create a downloadable document', risk: 'write',
      executor: 'device', interactionMode: 'structured', confirmation: 'once_per_plan', scopes: ['files.write.user-export'],
      description: 'Create a real text document. Browser execution downloads it; iPhone execution creates a local file and presents the system share sheet.',
      inputDescription: '{ fileName ending in .txt, .md, .json or .csv, content, optional mimeType }',
    },
    validate(raw, deferred = new Set()) {
      const input = object(raw, 'file create input');
      rejectUnknown(input, ['fileName', 'content', 'mimeType'], 'file create input');
      const fileName = string(input.fileName, 'fileName', { max: 160 });
      if (!/^[^\\/:*?"<>|]+\.(txt|md|json|csv)$/i.test(fileName)) throw new Error('fileName extension is not supported');
      return {
        fileName,
        ...(deferred.has('content') && input.content === undefined ? {} : { content: string(input.content, 'content', { max: 200000 }) }),
        ...(input.mimeType === undefined ? {} : { mimeType: string(input.mimeType, 'mimeType', { max: 100 }) }),
      };
    },
  },
};

function publicCapabilityCatalog() {
  return Object.values(CAPABILITY_CATALOG).map(({ descriptor }) => descriptor);
}

function validateCapabilityInput(capabilityId, input, { deferredKeys = [] } = {}) {
  const capability = CAPABILITY_CATALOG[capabilityId];
  if (!capability) throw new Error(`Capability is not registered: ${capabilityId}`);
  for (const key of deferredKeys) if (!capability.inputKeys.includes(key)) throw new Error(`Capability input does not support binding target: ${key}`);
  return { descriptor: capability.descriptor, input: capability.validate(input, new Set(deferredKeys)) };
}

module.exports = { CAPABILITY_CATALOG, publicCapabilityCatalog, validateCapabilityInput };
