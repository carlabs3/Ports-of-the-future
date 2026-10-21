// Adaptation measures — the 26 buyable cards (workshop v4, Appendix B).
// Source of truth for scoring. Transcribe EXACTLY.
//
// protection: tokens of protection per event code (SS RF HW WS DR WF SI).
//   A "–" in the source document means 0 (no protection).
// cost: coins to buy the card (1–5).
// raisesCultureLevel: true ONLY for the two enablers #19 and #20 (no protection).
// description: the card text, from docs/workshop-v4.md ("Card texts").

export const MEASURES = [
  { id: 1,  name: 'Coastal defence structures', cost: 5, raisesCultureLevel: false, protection: { SS: 8, RF: 0, HW: 0, WS: 3, DR: 0, WF: 0, SI: 0 },
    description: "Seawalls, breakwaters and revetments form the port's outer shield. They absorb and deflect wave energy before it reaches quays and yards, and stop most storm-surge flooding up to the storm they were designed for. A bigger storm can still overtop them. Expensive, long-lasting, and of no use against hazards that come from the land." },
  { id: 2,  name: 'Elevated critical infrastructure', cost: 4, raisesCultureLevel: false, protection: { SS: 7, RF: 4, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Substations, control rooms, pumps and IT are raised above projected flood levels, and new berths are built higher. When water arrives, the port's nervous system stays dry. Very effective against coastal flooding and helpful in river or rain floods, but it only protects what has been raised." },
  { id: 3,  name: 'Deployable flood barriers', cost: 3, raisesCultureLevel: false, protection: { SS: 5, RF: 5, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Temporary barriers, including modular 3D-printed units, set up across gates, doors and low points when a flood is forecast. Much cheaper than a permanent wall and useful against both sea and river water. They only work if the warning comes early enough and the team knows where to put them." },
  { id: 4,  name: 'Green infrastructure & permeable surfaces', cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 5, HW: 2, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Green roofs, rain gardens and permeable paving let rain soak into the ground instead of rushing into the drains. They cut flooding from heavy rain up to the storm they were sized for, and planted areas take a few degrees off the hottest afternoons. A true cloudburst will still overwhelm them." },
  { id: 5,  name: 'Nature-based coastal & riverbank protection', cost: 2, raisesCultureLevel: false, protection: { SS: 4, RF: 3, HW: 0, WS: 2, DR: 0, WF: 0, SI: 0 },
    description: "Restored wetlands, mangroves, salt marsh and planted riverbanks, sometimes built with dredged sediment, stabilise the shoreline and slow incoming water. They reduce erosion, soften surges and river floods, and bring biodiversity back. They protect less than concrete and take years to mature, but they grow stronger over time instead of weaker." },
  { id: 6,  name: 'Structural health monitoring', cost: 3, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 2, WS: 3, DR: 0, WF: 0, SI: 3 },
    description: "Sensors on locks, quay walls, cranes and rail track measure stress, vibration and deformation around the clock. Monitoring stops no storm, but it shows where a structure is close to failing, so it can be repaired before a flood, gale, heatwave or hard freeze finishes the job." },
  { id: 7,  name: 'Digital twin & predictive maintenance', cost: 4, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 2, WS: 2, DR: 3, WF: 0, SI: 3 },
    description: "A virtual replica of a critical asset, such as a lock or a rail network, fed with live data. It predicts how the asset degrades under heat, frost, floods or low water and schedules maintenance before failure. Especially useful in river ports, where it helps run the lock when water levels turn critical." },
  { id: 8,  name: 'Early warning & forecasting system', cost: 2, raisesCultureLevel: false, protection: { SS: 2, RF: 2, HW: 2, WS: 2, DR: 2, WF: 2, SI: 2 },
    description: "Port-specific weather alerts with operational thresholds for wind, rain, heat, frost and water levels. A warning stops nothing on its own, but a few hours of notice let the port secure cargo, stop cranes, move equipment and protect people. It helps a little against every hazard." },
  { id: 9,  name: 'Real-time operations platform', cost: 3, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 0, WS: 3, DR: 3, WF: 0, SI: 3 },
    description: "A shared digital platform that reroutes vessels, trains and trucks before and during a disruption, anticipates congestion and organises the recovery. It doesn't protect assets: it keeps cargo moving while the weather does its worst, cutting the operational losses of floods, storms, low water and ice." },
  { id: 10, name: 'Emergency response plan & drills', cost: 2, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 3, WS: 3, DR: 0, WF: 2, SI: 3 },
    description: "A plan that assigns roles, evacuation routes, communication chains and equipment-protection steps for each hazard, tested in regular drills. It protects people first and assets second, and reduces losses in almost every type of event. An untested plan is paper; a drilled one saves time, cargo and lives." },
  { id: 11, name: 'Worker heat-protection protocol', cost: 1, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 7, WS: 0, DR: 0, WF: 2, SI: 0 },
    description: "Shaded rest areas, water stations, earlier shifts and heat-stress monitoring for outdoor staff. In ports, much of the cost of a heatwave comes from sick workers and lost hours, and this cheap measure tackles exactly that. It also helps when wildfire smoke makes outdoor work unsafe." },
  { id: 12, name: 'Climate-resilient materials & retrofits', cost: 4, raisesCultureLevel: false, protection: { SS: 3, RF: 3, HW: 3, WS: 5, DR: 0, WF: 2, SI: 3 },
    description: "Buildings, warehouses and workshops are reinforced with materials designed for high winds, driving rain, extreme heat and freeze-thaw cycles. Moderate protection against almost everything, strongest against wind, but it covers buildings, not yards, channels or cranes. Broad and solid, at a high price." },
  { id: 13, name: 'Wind-resistant mooring & crane reinforcement', cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 0, WS: 7, DR: 0, WF: 0, SI: 2 },
    description: "Reinforced mooring systems, crane tie-downs, storm pins, wind-speed interlocks and secured container stacks. Cranes and moored ships are where wind does its worst damage in a port, and this measure goes straight at that. Very effective in gales and cyclones, a little help when ice loads equipment, useless against water." },
  { id: 14, name: 'Backup power & microgrid', cost: 3, raisesCultureLevel: false, protection: { SS: 1, RF: 1, HW: 4, WS: 2, DR: 0, WF: 1, SI: 3 },
    description: "Generators, batteries and on-site solar keep pumps, cooling, reefers, communications and IT running when the grid fails. Power cuts make every disaster worse. Backup power matters most in heatwaves, when demand peaks, and in ice storms, when lines come down. It does little once water is inside the building." },
  { id: 15, name: 'Drainage system upgrade', cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 7, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Bigger stormwater pipes, new pumping stations and cleared channels, sized for today's downpours rather than those of 1980. The most direct answer to flooding from intense rain: water leaves the port as fast as it falls. A storm beyond the new design can still overwhelm it, and it does nothing against the sea." },
  { id: 16, name: 'Alternative water supply & reuse', cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 1, WS: 0, DR: 6, WF: 2, SI: 0 },
    description: "Rainwater harvesting, treated wastewater reuse and a second, independent supply such as a small desalination unit. When drought restricts the main supply, the port keeps washing, cooling, suppressing dust and fighting fires. Essential where water is scarce, and it adds a little cooling capacity during heatwaves." },
  { id: 17, name: 'Multimodal shift platform', cost: 2, raisesCultureLevel: false, protection: { SS: 2, RF: 3, HW: 0, WS: 3, DR: 2, WF: 2, SI: 2 },
    description: "Rail sidings, barge connections and agreements that let cargo switch between road, rail and water when one route fails: flooded roads, closed terminals, low rivers, icy highways. It protects flows rather than assets, keeping trade moving around the damage." },
  { id: 18, name: 'Artificial reefs & wave dissipation', cost: 3, raisesCultureLevel: false, protection: { SS: 4, RF: 0, HW: 0, WS: 2, DR: 0, WF: 0, SI: 0 },
    description: "Submerged structures, including 3D-printed reefs made from natural materials, break wave energy offshore before it reaches the port's defences, while creating marine habitat. They take the force out of storm waves and slow erosion, but a surge still raises the water level: reefs blunt the blow, they don't block it." },
  { id: 19, name: 'Governance & institutional protocols', cost: 1, raisesCultureLevel: true, protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Formal rules on who decides what, when and with whom, before and during extreme weather, shared by the port authority, terminal operators, city and emergency services. On its own it protects nothing. But fragmented governance quietly ruins good technical measures, and clear protocols make every other card work better." },
  { id: 20, name: 'Capacity building & training programme', cost: 1, raisesCultureLevel: true, protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Regular, hazard-specific training for staff: e-learning modules, scenario exercises, cross-department simulations. Trained people improvise less and act faster. Like governance, its value lies in making the plan, the warnings and the equipment actually work under pressure." },
  { id: 21, name: 'Adaptive dredging & sediment management', cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 3, HW: 0, WS: 0, DR: 6, WF: 0, SI: 0 },
    description: "Drone and sonar surveys show where the channel silts up; dredging is targeted and the sediment reused to strengthen banks. For river and estuary ports it is the first defence against low-water navigation limits, and a clean channel also carries floodwater away faster." },
  { id: 22, name: 'Stormwater retention & storage basins', cost: 3, raisesCultureLevel: false, protection: { SS: 0, RF: 6, HW: 0, WS: 0, DR: 3, WF: 1, SI: 0 },
    description: "Basins and tanks catch peak rainfall before it floods the port, then hold that water for dry periods: dust suppression, cooling, firefighting reserves. One infrastructure for two opposite problems, too much water and too little." },
  { id: 23, name: 'Parametric climate insurance', cost: 1, raisesCultureLevel: false, protection: { SS: 1, RF: 1, HW: 1, WS: 1, DR: 1, WF: 1, SI: 1 },
    description: "Insurance that pays out automatically when a measured trigger is crossed (wind speed, water level, temperature), without a long loss assessment. It prevents nothing physically, but it turns a financial shock into a manageable one and pays for a fast recovery. Transferring risk is not the same as reducing it." },
  { id: 24, name: 'Winterisation package', cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 0, WS: 0, DR: 0, WF: 0, SI: 7 },
    description: "De-icing systems for cranes and gantries, heated rail switches, snow-clearing equipment, insulated pipes and cold-weather gear for staff. During an ice storm it makes the difference between a paralysed port and a working one. Entirely specific: it does nothing the rest of the year." },
  { id: 25, name: 'Firebreaks & vegetation management', cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 1, WS: 0, DR: 0, WF: 6, SI: 0 },
    description: "Cleared buffer strips, managed vegetation along the perimeter and access corridors, and joint plans with regional fire services. Wildfire reaches a port through its surroundings: access roads, power lines, the edge of fuel storage. Managing that interface keeps the flames, and most of the disruption, at a distance." },
  { id: 26, name: 'Cool surfaces & shaded yards', cost: 2, raisesCultureLevel: false, protection: { SS: 0, RF: 0, HW: 5, WS: 0, DR: 0, WF: 0, SI: 0 },
    description: "Reflective coatings on yards and roofs, shade structures over work areas and reefer stacks, light-coloured paving. Surface temperatures drop by several degrees, equipment overheats less and outdoor work stays possible for longer. A targeted answer to heat, with nothing to offer against water or wind." },
]

// Shared cards that must be in every port's deck (v4 Appendix A).
export const SHARED_MEASURE_IDS = [8, 10, 14, 19, 20, 23]

// Indexable by id.
export const MEASURES_BY_ID = Object.fromEntries(MEASURES.map(m => [m.id, m]))
