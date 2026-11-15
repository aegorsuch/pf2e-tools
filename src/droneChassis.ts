import type { Character, DroneChassis, DroneProfile } from './types'

export const DRONE_CHASSIS: readonly DroneChassis[] = ['Agile', 'Imitator', 'Powerful', 'Surveillance', 'Tank']

export function switchDroneChassis(c: Character, chassis: DroneChassis): Partial<Character> {
  const profiles = { ...c.mechanicDroneProfiles }
  if (c.mechanicDroneChassis) profiles[c.mechanicDroneChassis] = {
    size: c.mechanicDroneSize,
    imitator: c.mechanicDroneImitator,
    racerSpeed: c.mechanicDroneRacerSpeed,
    customizations: c.mechanicDroneCustomizations,
  } satisfies DroneProfile
  const next = profiles[chassis]
  return {
    mechanicDroneBaseChassis: c.mechanicDroneBaseChassis ?? c.mechanicDroneChassis ?? chassis,
    mechanicDroneChassis: chassis,
    mechanicDroneProfiles: profiles,
    mechanicDroneSize: next?.size,
    mechanicDroneImitator: next?.imitator,
    mechanicDroneRacerSpeed: next?.racerSpeed,
    mechanicDroneCustomizations: next?.customizations,
  }
}
