import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { CapabilityAdapter, CapabilityError } from './types';

interface CreateCalendarEventInput {
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
  timeZone?: string;
}

const parseInput = (input: Record<string, unknown>): CreateCalendarEventInput => {
  const { title, startDate, endDate, location, notes, timeZone } = input;
  if (typeof title !== 'string' || !title.trim()) throw new CapabilityError('terminal', 'Calendar title is required');
  if (typeof startDate !== 'string' || Number.isNaN(Date.parse(startDate))) {
    throw new CapabilityError('terminal', 'Calendar startDate must be an ISO date');
  }
  if (typeof endDate !== 'string' || Number.isNaN(Date.parse(endDate))) {
    throw new CapabilityError('terminal', 'Calendar endDate must be an ISO date');
  }
  if (Date.parse(endDate) <= Date.parse(startDate)) {
    throw new CapabilityError('terminal', 'Calendar endDate must be after startDate');
  }
  return {
    title: title.trim(),
    startDate,
    endDate,
    location: typeof location === 'string' ? location : undefined,
    notes: typeof notes === 'string' ? notes : undefined,
    timeZone: typeof timeZone === 'string' ? timeZone : undefined,
  };
};

const writableCalendar = async () => {
  if (Platform.OS === 'ios') return Calendar.getDefaultCalendarSync();
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const selected = calendars.find((calendar) => calendar.isPrimary && calendar.allowsModifications)
    ?? calendars.find((calendar) => calendar.allowsModifications);
  if (!selected) throw new CapabilityError('decision_required', 'No writable calendar is available');
  return selected;
};

export const calendarCreateEventAdapter: CapabilityAdapter = {
  descriptor: {
    id: 'system.calendar.createEvent',
    title: 'Create calendar event',
    risk: 'write',
    executor: 'device',
    interactionMode: 'structured',
    confirmation: 'once_per_plan',
    scopes: ['calendar.write'],
  },
  async execute(rawInput, context) {
    if (context.signal.aborted) throw new CapabilityError('cancelled', 'Calendar execution was cancelled');
    const input = parseInput(rawInput);
    const permission = await Calendar.requestCalendarPermissions(Platform.OS === 'ios');
    if (!permission.granted) {
      throw new CapabilityError('permission_denied', 'Calendar permission was not granted');
    }
    if (context.signal.aborted) throw new CapabilityError('cancelled', 'Calendar execution was cancelled');

    const calendar = await writableCalendar();
    const event = await calendar.createEvent({
      title: input.title,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      location: input.location,
      notes: input.notes,
      timeZone: input.timeZone,
      url: `taskspace://tasks/${context.taskId}`,
    });
    return { summary: `Created ${input.title} in Calendar`, externalId: event.id };
  },
};
