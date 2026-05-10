import L from 'leaflet'

export const gamePinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50%;
    background:#EF4444;border:3px solid #fff;
    box-shadow:0 2px 8px rgba(0,0,0,0.28);
    cursor:pointer;
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

export const userDotIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:16px;height:16px;border-radius:50%;
    background:#3B82F6;border:3px solid #fff;
    box-shadow:0 0 0 3px rgba(59,130,246,0.3),0 2px 8px rgba(0,0,0,0.2);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})
