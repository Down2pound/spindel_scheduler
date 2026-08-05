import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Heart, MapPin, Navigation, Save, X } from 'lucide-react';
import { OFFICE_LOCATIONS, appleMapsDirectionsUrl, googleMapsDirectionsUrl } from '../constants/locations';
import { TechnicianProfile } from '../services/technicianProfileService';

interface Props {
  initials: string;
  ownerUid: string;
  profile?: TechnicianProfile;
  onClose: () => void;
  onSave: (profile: TechnicianProfile) => Promise<void>;
}

export function TechnicianProfilePanel({ initials, ownerUid, profile, onClose, onSave }: Props) {
  const [homeAddress, setHomeAddress] = useState(profile?.homeAddress || '');
  const [ranking, setRanking] = useState<string[]>(profile?.officeRanking?.length
    ? profile.officeRanking
    : OFFICE_LOCATIONS.map(location => location.id));
  const [miles, setMiles] = useState<Record<string, number>>(profile?.commuteMiles || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHomeAddress(profile?.homeAddress || '');
    setRanking(profile?.officeRanking?.length ? profile.officeRanking : OFFICE_LOCATIONS.map(location => location.id));
    setMiles(profile?.commuteMiles || {});
  }, [profile, initials]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ranking.length) return;
    const next = [...ranking];
    [next[index], next[target]] = [next[target], next[index]];
    setRanking(next);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ initials, ownerUid, homeAddress: homeAddress.trim(), officeRanking: ranking, commuteMiles: miles });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button aria-label="Close profile" onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="brand-surface relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white border border-[#dce1eb] rounded-3xl p-8 shadow-2xl">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-pink-400 text-[0.6rem] font-black tracking-[.25em] uppercase mb-2"><Heart className="w-4 h-4" /> Happy schedule profile</div>
            <h2 className="text-2xl font-bold">{initials} office preferences</h2>
            <p className="text-xs text-white/40 mt-2">Rank offices from favorite to least favorite and record your usual one-way drive.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        <label className="block mb-8">
          <span className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">Starting address (optional)</span>
          <div className="relative mt-2">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input value={homeAddress} onChange={event => setHomeAddress(event.target.value)} placeholder="Home address or town" className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-white/30" />
          </div>
          <span className="block mt-2 text-[0.6rem] text-white/25">Used only to prefill directions. Leave blank to let your map app use your current location.</span>
        </label>

        <div className="space-y-3">
          {ranking.map((officeId, index) => {
            const office = OFFICE_LOCATIONS.find(item => item.id === officeId)!;
            return (
              <div key={officeId} className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_150px_auto] items-center gap-3 p-3 bg-white/[.03] border border-white/10 rounded-2xl">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black" style={{ color: office.color, backgroundColor: `${office.color}20` }}>{index + 1}</div>
                <div>
                  <div className="font-bold">{office.id}</div>
                  <div className="text-[0.55rem] text-white/30 uppercase tracking-widest">{index === 0 ? 'Favorite office' : index === ranking.length - 1 ? 'Least favorite' : `Preference ${index + 1}`}</div>
                </div>
                <label className="col-span-2 md:col-span-1 flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2">
                  <input type="number" min="0" step="0.1" value={miles[officeId] ?? ''} onChange={event => setMiles({ ...miles, [officeId]: Math.max(0, Number(event.target.value)) })} placeholder="--" className="w-full bg-transparent text-right font-mono text-sm focus:outline-none" />
                  <span className="text-[0.6rem] text-white/30">MI</span>
                </label>
                <div className="flex gap-1">
                  <button aria-label={`Move ${officeId} up`} onClick={() => move(index, -1)} disabled={index === 0} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button>
                  <button aria-label={`Move ${officeId} down`} onClick={() => move(index, 1)} disabled={index === ranking.length - 1} className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button>
                </div>
                <div className="col-span-3 md:col-start-2 md:col-span-3 flex gap-2">
                  <a target="_blank" rel="noreferrer" href={googleMapsDirectionsUrl(office.mapQuery!, homeAddress)} className="flex items-center gap-1.5 text-[0.55rem] font-bold px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg"><Navigation className="w-3 h-3" /> GOOGLE MAPS</a>
                  <a target="_blank" rel="noreferrer" href={appleMapsDirectionsUrl(office.mapQuery!, homeAddress)} className="flex items-center gap-1.5 text-[0.55rem] font-bold px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg">APPLE MAPS</a>
                </div>
              </div>
            );
          })}
        </div>

        <button disabled={saving} onClick={submit} className="mt-8 w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-4 rounded-xl disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'SAVING...' : 'SAVE PROFILE'}</button>
      </motion.div>
    </div>
  );
}
