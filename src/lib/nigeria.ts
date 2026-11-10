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

export function citiesForState(state: string | null | undefined): string[] {
  if (!state) return [];
  return NIGERIAN_CITIES[state] ?? [];
}

export function formatNaira(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
