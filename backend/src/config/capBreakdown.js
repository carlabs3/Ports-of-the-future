// CAP results "By <dimension>" views — one config entry per profile question.
// `field` is the ParIndexResult field; `groups[].key` is the stored option id;
// `label` is the short screen label (in display order). Colours are assigned by
// group order and shared by every view. No red/amber/green (those mean
// protection level elsewhere).
export const CAP_GROUP_COLORS = ['#1F8A84', '#4E77C2', '#13245E', '#7A5AA6', '#9A6B3F']

export const CAP_DIMENSIONS = {
  portSize: {
    field: 'portSize',
    title: 'Does port size make a difference?',
    byLabel: 'port size',
    prompt: 'Ask the room: do small ports really score lower on organisation?',
    groups: [
      { key: 'small', label: 'Small' },
      { key: 'medium', label: 'Medium' },
      { key: 'large', label: 'Large' },
    ],
  },
  governance: {
    field: 'governance',
    title: 'Does the governance model make a difference?',
    byLabel: 'governance',
    prompt: 'Ask the room: does who runs the port change who plans for climate risk?',
    groups: [
      { key: 'landlord', label: 'Landlord' },
      { key: 'public', label: 'Public' },
      { key: 'private', label: 'Private' },
      { key: 'tool', label: 'Tool' },
      { key: 'other', label: 'Other' },
    ],
  },
  climateZone: {
    field: 'climateZone',
    title: 'Does the climate zone make a difference?',
    byLabel: 'climate zone',
    prompt: 'Ask the room: do ports facing harsher climates feel more ready?',
    groups: [
      { key: 'tropical', label: 'Tropical' },
      { key: 'arid', label: 'Arid' },
      { key: 'mediterranean', label: 'Mediterranean' },
      { key: 'temperate', label: 'Temperate' },
      { key: 'cold', label: 'Cold' },
    ],
  },
  coastalSetting: {
    field: 'coastalSetting',
    title: 'Does the coastal setting make a difference?',
    byLabel: 'coastal setting',
    prompt: 'Ask the room: does the type of coastline change how ready ports feel?',
    groups: [
      { key: 'open-coast', label: 'Open coast' },
      { key: 'estuary', label: 'Estuary / river' },
      { key: 'bay', label: 'Bay / lagoon' },
      { key: 'artificial', label: 'Artificial' },
    ],
  },
}

// Tab order for the Results step (Room first, then the four dimensions).
export const CAP_DIMENSION_ORDER = ['portSize', 'governance', 'climateZone', 'coastalSetting']
