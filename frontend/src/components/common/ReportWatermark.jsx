import React from 'react';

export default function ReportWatermark({
  imageSrc = '/images/rebinmas.webp',
  label = 'REBINMAS',
}) {
  return (
    <div className="report-watermark" aria-hidden="true">
      <div className="report-watermark__mark">
        <img className="report-watermark__image" src={imageSrc} alt="" />
        <div className="report-watermark__text">{label}</div>
      </div>
    </div>
  );
}
