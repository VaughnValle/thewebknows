import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ExternalLink } from './ExternalLink';
import { Icon } from './Icon';
import { formatExifDate, readPhotoMeta, stripMetadata, type PhotoMeta } from '../lib/photo/exif';
import { mapUrl } from '../lib/platforms/safeUrl';

interface Checked {
  name: string;
  file: File;
  preview: string;
  meta: PhotoMeta;
}

const MAX_BYTES = 40 * 1024 * 1024;

/** Look inside a photo for hidden location, camera and time. Runs entirely on the device. */
export function PhotoCheck() {
  const [checked, setChecked] = useState<Checked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (checked) URL.revokeObjectURL(checked.preview);
  }, [checked]);

  const inspect = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('That doesn’t look like an image.');
    if (file.size > MAX_BYTES) return setError('That file is very large. Try a photo under 40 MB.');
    const meta = readPhotoMeta(await file.arrayBuffer());
    setChecked((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { name: file.name, file, preview: URL.createObjectURL(file), meta };
    });
  };

  const download = async () => {
    if (!checked) return;
    setBusy(true);
    try {
      const blob = await stripMetadata(checked.file);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = checked.name.replace(/\.[^.]+$/, '') + '-clean.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Your browser couldn’t re-save this photo.');
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    void inspect(e.dataTransfer.files?.[0]);
  };

  const m = checked?.meta;
  const map = m?.gps ? mapUrl(m.gps.latitude, m.gps.longitude) : null;
  const found = m ? [m.gps, m.camera, m.lens, m.takenAt, m.software].filter(Boolean).length + m.other.length : 0;

  return (
    <section className="report-group photo-check" aria-labelledby="photo-h">
      <h2 id="photo-h" className="report-title">
        <Icon name="image" size={18} /> Check a photo before you post it
      </h2>
      <p className="report-blurb">
        Photos can carry where and when they were taken, and on which device. Pick one to see. It stays on your device; nothing is
        uploaded.
      </p>

      {!checked ? (
        <div
          className={`photo-drop${drag ? ' is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <button type="button" className="btn btn-secondary" onClick={() => input.current?.click()}>
            <Icon name="image" size={16} /> Choose a photo
          </button>
          <span className="small muted">or drop it here</span>
        </div>
      ) : (
        <div className="photo-result">
          <img src={checked.preview} alt="" className="photo-thumb" />
          <div className="photo-facts">
            {!m!.isJpeg ? (
              <p>We can read hidden details from JPEG photos, the format most phones and cameras share. This file type isn’t supported yet.</p>
            ) : found === 0 ? (
              <p className="photo-clean">
                <Icon name="check-circle" size={18} /> No hidden location, camera or date found in this photo.
              </p>
            ) : (
              <>
                {m!.gps ? (
                  <p className="photo-alert">
                    <Icon name="pin" size={18} /> This photo includes where it was taken.
                  </p>
                ) : (
                  <p className="photo-ok">
                    <Icon name="check-circle" size={18} /> No location inside. Other details are:
                  </p>
                )}
                <dl className="photo-list">
                  {m!.gps && (
                    <div>
                      <dt>Location</dt>
                      <dd>
                        {m!.gps.latitude.toFixed(5)}, {m!.gps.longitude.toFixed(5)}
                        {map && (
                          <>
                            {' '}
                            <ExternalLink href={map} className="text-link">
                              View on map
                            </ExternalLink>
                          </>
                        )}
                      </dd>
                    </div>
                  )}
                  {m!.takenAt && (
                    <div>
                      <dt>Taken</dt>
                      <dd>{formatExifDate(m!.takenAt)}</dd>
                    </div>
                  )}
                  {m!.camera && (
                    <div>
                      <dt>Device</dt>
                      <dd>{m!.camera}</dd>
                    </div>
                  )}
                  {m!.lens && (
                    <div>
                      <dt>Lens</dt>
                      <dd>{m!.lens}</dd>
                    </div>
                  )}
                  {m!.software && (
                    <div>
                      <dt>Software</dt>
                      <dd>{m!.software}</dd>
                    </div>
                  )}
                  {m!.other.length > 0 && (
                    <div>
                      <dt>Also embedded</dt>
                      <dd>{m!.other.join(', ')} metadata</dd>
                    </div>
                  )}
                </dl>
                <p className="small muted">
                  Many big platforms remove this when you post, but messaging apps, email, forums and file sharing often keep it.
                </p>
              </>
            )}
            <div className="card-actions">
              {m!.isJpeg && found > 0 && (
                <button type="button" className="btn btn-primary btn-sm" onClick={download} disabled={busy}>
                  <Icon name="download" size={15} /> {busy ? 'Cleaning…' : 'Download a clean copy'}
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current?.click()}>
                Check another
              </button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          <Icon name="info" size={16} /> {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Choose a photo to check"
        onChange={(e) => {
          void inspect(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </section>
  );
}
