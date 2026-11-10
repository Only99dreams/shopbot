export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

/**
 * Major towns/cities per state. The lists are intentionally practical rather
 * than exhaustive; buyers and agents can always type a city that is missing.
 */
export const NIGERIAN_CITIES: Record<string, string[]> = {
  Abia: ['Aba', 'Umuahia', 'Arochukwu', 'Ohafia', 'Bende'],
  Adamawa: ['Yola', 'Mubi', 'Jimeta', 'Numan', 'Ganye'],
  'Akwa Ibom': ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Abak'],
  Anambra: ['Awka', 'Onitsha', 'Nnewi', 'Ekwulobia', 'Aguata'],
  Bauchi: ['Bauchi', 'Azare', 'Misau', 'Jama\'are', 'Tafawa Balewa'],
  Bayelsa: ['Yenagoa', 'Ogbia', 'Sagbama', 'Brass', 'Nembe'],
  Benue: ['Makurdi', 'Gboko', 'Otukpo', 'Katsina-Ala', 'Vandeikya'],
  Borno: ['Maiduguri', 'Biu', 'Bama', 'Dikwa', 'Konduga'],
  'Cross River': ['Calabar', 'Ugep', 'Ogoja', 'Ikom', 'Obudu'],
  Delta: ['Asaba', 'Warri', 'Sapele', 'Ughelli', 'Agbor'],
  Ebonyi: ['Abakaliki', 'Afikpo', 'Onueke', 'Ishieke', 'Uburu'],
  Edo: ['Benin City', 'Auchi', 'Ekpoma', 'Uromi', 'Igarra'],
  Ekiti: ['Ado-Ekiti', 'Ikere-Ekiti', 'Ise-Ekiti', 'Emure-Ekiti', 'Omuo-Ekiti'],
  Enugu: ['Enugu', 'Nsukka', 'Oji River', 'Awgu', 'Udi'],
  FCT: ['Abuja', 'Gwagwalada', 'Kuje', 'Bwari', 'Kwali'],
  Gombe: ['Gombe', 'Kaltungo', 'Billiri', 'Bajoga', 'Dukku'],
  Imo: ['Owerri', 'Orlu', 'Okigwe', 'Mbaise', 'Oguta'],
  Jigawa: ['Dutse', 'Hadejia', 'Gumel', 'Birnin Kudu', 'Kazaure'],
  Kaduna: ['Kaduna', 'Zaria', 'Kafanchan', 'Kagoro', 'Saminaka'],
  Kano: ['Kano', 'Wudil', 'Gwarzo', 'Rano', 'Bichi'],
  Katsina: ['Katsina', 'Daura', 'Funtua', 'Malumfashi', 'Dutsin-Ma'],
  Kebbi: ['Birnin Kebbi', 'Argungu', 'Yauri', 'Zuru', 'Jega'],
  Kogi: ['Lokoja', 'Okene', 'Idah', 'Kabba', 'Ankpa'],
  Kwara: ['Ilorin', 'Offa', 'Omu-Aran', 'Jebba', 'Patigi'],
  Lagos: ['Ikeja', 'Lekki', 'Victoria Island', 'Ikorodu', 'Surulere', 'Yaba', 'Apapa', 'Agege', 'Alimosho', 'Badagry', 'Epe', 'Ojota'],
  Nasarawa: ['Lafia', 'Keffi', 'Akwanga', 'Karu', 'Nasarawa'],
  Niger: ['Minna', 'Bida', 'Suleja', 'Kontagora', 'Lapai'],
  Ogun: ['Abeokuta', 'Sagamu', 'Ijebu Ode', 'Ota', 'Sango Ota', 'Ilaro'],
  Ondo: ['Akure', 'Ondo', 'Owo', 'Ikare', 'Okitipupa'],
  Osun: ['Osogbo', 'Ile-Ife', 'Ilesa', 'Ede', 'Iwo'],
  Oyo: ['Ibadan', 'Ogbomoso', 'Oyo', 'Iseyin', 'Saki'],
  Plateau: ['Jos', 'Bukuru', 'Pankshin', 'Barkin Ladi', 'Shendam'],
  Rivers: ['Port Harcourt', 'Bonny', 'Eleme', 'Okrika', 'Omoku'],
  Sokoto: ['Sokoto', 'Tambuwal', 'Illela', 'Gwadabawa', 'Wurno'],
  Taraba: ['Jalingo', 'Wukari', 'Bali', 'Serti', 'Takum'],
  Yobe: ['Damaturu', 'Potiskum', 'Gashua', 'Nguru', 'Geidam'],
  Zamfara: ['Gusau', 'Kaura Namoda', 'Talata Mafara', 'Anka', 'Zurmi'],
};

/** Approximate state capitals, used to centre maps when exact coordinates are missing. */
export const NIGERIAN_STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  Abia: { lat: 5.4527, lng: 7.5248 },
  Adamawa: { lat: 9.3265, lng: 12.3984 },
  'Akwa Ibom': { lat: 5.0377, lng: 7.9128 },
  Anambra: { lat: 6.2209, lng: 6.937 },
  Bauchi: { lat: 10.3103, lng: 9.8439 },
  Bayelsa: { lat: 4.7719, lng: 6.0699 },
  Benue: { lat: 7.7322, lng: 8.5391 },
  Borno: { lat: 11.8311, lng: 13.151 },
  'Cross River': { lat: 4.9757, lng: 8.3417 },
  Delta: { lat: 6.198, lng: 6.7306 },
  Ebonyi: { lat: 6.3249, lng: 8.1137 },
  Edo: { lat: 6.335, lng: 5.6037 },
  Ekiti: { lat: 7.6211, lng: 5.2214 },
  Enugu: { lat: 6.4584, lng: 7.5464 },
  FCT: { lat: 9.0765, lng: 7.3986 },
  Gombe: { lat: 10.2791, lng: 11.1673 },
  Imo: { lat: 5.484, lng: 7.0351 },
  Jigawa: { lat: 11.6971, lng: 9.3407 },
  Kaduna: { lat: 10.5105, lng: 7.4165 },
  Kano: { lat: 12.0022, lng: 8.5919 },
  Katsina: { lat: 12.9908, lng: 7.6018 },
  Kebbi: { lat: 12.4539, lng: 4.1975 },
  Kogi: { lat: 7.8023, lng: 6.7333 },
  Kwara: { lat: 8.4966, lng: 4.5421 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Nasarawa: { lat: 8.4905, lng: 8.5201 },
  Niger: { lat: 9.5836, lng: 6.5463 },
  Ogun: { lat: 7.1557, lng: 3.3451 },
  Ondo: { lat: 7.2571, lng: 5.2058 },
  Osun: { lat: 7.7669, lng: 4.5554 },
  Oyo: { lat: 7.3775, lng: 3.947 },
  Plateau: { lat: 9.8965, lng: 8.8583 },
  Rivers: { lat: 4.8156, lng: 7.0498 },
  Sokoto: { lat: 13.0059, lng: 5.2476 },
  Taraba: { lat: 8.8833, lng: 11.3667 },
  Yobe: { lat: 11.7479, lng: 11.966 },
  Zamfara: { lat: 12.1704, lng: 6.6641 },
};

export function stateCenter(state: string | null | undefined) {
  if (!state) return null;
  return NIGERIAN_STATE_CENTERS[state] ?? null;
}

export function citiesForState(state: string | null | undefined): string[] {
  if (!state) return [];
  return NIGERIAN_CITIES[state] ?? [];
}

export function formatNaira(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
