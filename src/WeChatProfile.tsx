import {useEffect, useState} from 'react';
import WeChatIcon from './WeChatIcon';
import type {StaffRequest, StaffUser} from './staff-types';

async function prepareQr(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw Error('Choose a PNG, JPEG or WebP image.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (Math.min(image.naturalWidth, image.naturalHeight) < 96) throw Error('Choose a larger image so buyers can scan the code.');
    const scale = Math.min(1, 720 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d', {alpha: false});
    if (!context || Math.min(canvas.width, canvas.height) < 96) throw Error('Choose an image cropped around the full QR code.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL('image/jpeg', .94);
    if (jpeg.length <= 180000) return jpeg;
    const compressed = canvas.toDataURL('image/jpeg', .86);
    if (compressed.length > 180000) throw Error('Crop the image around the QR code and try again.');
    return compressed;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function WeChatProfile({user, request, updated}: {
  user: StaffUser; request: StaffRequest; updated: (user: StaffUser) => void;
}) {
  const [id, setId] = useState(user.wechatId ?? '');
  const [qr, setQr] = useState(user.wechatQr ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {setId(user.wechatId ?? ''); setQr(user.wechatQr ?? '');}, [user.wechatId, user.wechatQr]);
  const dirty = id.trim() !== (user.wechatId ?? '') || qr !== (user.wechatQr ?? '');

  async function upload(file: File) {
    setBusy(true);
    setMessage('');
    try {
      setQr(await prepareQr(file));
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'Error' ? error.message : 'The QR image could not be opened.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      updated(await request('profile', {wechatId: id.trim(), wechatQr: qr}));
      setMessage(id.trim() || qr ? 'WeChat details saved to your buyer links.' : 'WeChat details removed from your buyer links.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save your WeChat details.');
    } finally {
      setBusy(false);
    }
  }

  return <form className="profile-details-form wechat-profile" onSubmit={event => {event.preventDefault(); void save();}}>
    <h2><WeChatIcon/>WeChat</h2>
    <p>Add your WeChat ID, QR code, or both. Buyers can see these details on your personal portfolio and collection links.</p>
    <fieldset disabled={busy}>
      <label>WeChat ID<input value={id} maxLength={40} autoComplete="off" spellCheck={false} placeholder="Your WeChat ID"
        onChange={event => {setId(event.target.value); setMessage('');}}/></label>
      <label>WeChat QR image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void upload(file);
      }}/></label>
      {qr && <div className="wechat-profile-preview"><img src={qr} alt="Preview of your WeChat QR image"/>
        <button type="button" onClick={() => {setQr(''); setMessage('');}}>Remove QR image</button></div>}
      <button className="primary" disabled={!dirty || busy}>Save WeChat details</button>
    </fieldset>
    {message && <p role="status">{message}</p>}
  </form>;
}
