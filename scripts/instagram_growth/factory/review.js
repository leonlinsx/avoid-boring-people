/* global document, localStorage */
const manifest = JSON.parse(document.getElementById('manifest').textContent);
const form = document.getElementById('review-form');
const status = document.getElementById('status');
// Local progress is a convenience only. Export/import is the durable decision.
const key = `abp-review-${manifest.batch_id}`;
try {
  const saved = JSON.parse(localStorage.getItem(key) || '{}');
  for (const [name, value] of Object.entries(saved)) {
    const control = form.elements.namedItem(name);
    if (control && name !== 'confirmed') control.value = value;
  }
} catch { /* file:// storage can be unavailable; explicit export still works. */ }
form.addEventListener('change', () => {
  const values = Object.fromEntries(new FormData(form));
  delete values.confirmed;
  try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* Optional. */ }
});
form.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  const decisions = manifest.items.map(row => ({concept_id:row.concept_id, video_sha256:row.video_sha256,
    decision:data.get(row.concept_id) || 'pending', notes:data.get(`${row.concept_id}-notes`) || ''}));
  for (const row of decisions) {
    const original = manifest.items.find(x => x.concept_id === row.concept_id);
    if (row.decision !== 'pending' && (row.decision !== 'approve' || original.findings.length) && !row.notes.trim()) {
      status.textContent = `Add notes for ${row.concept_id}.`;
      document.getElementById(`${row.concept_id}-notes`).focus(); return;
    }
  }
  const result = {account:'avoidboringpeople', batch_id:manifest.batch_id, reviewer:data.get('reviewer'),
    confirmed_review:data.get('confirmed') === 'on', reviewed_at:new Date().toISOString(), decisions};
  const url = URL.createObjectURL(new Blob([JSON.stringify(result,null,2)], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `abp-decisions-${manifest.batch_id.slice(0,12)}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Decision file exported. Import it with the review CLI to record decisions durably. Nothing has been uploaded or published.';
});
// Keep just one audio track playing during a long review session.
document.addEventListener('play', event => {
  for (const video of document.querySelectorAll('video')) if (video !== event.target) video.pause();
}, true);
