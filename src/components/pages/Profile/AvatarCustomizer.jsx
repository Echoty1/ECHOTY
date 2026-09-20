// src/components/pages/Profile/AvatarCustomizer.js
import React, { useState } from 'react';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { SKINS, HAIR_STYLES, OUTFITS, EYE_COLORS, EYEBROW_STYLES, MOUTH_STYLES } from '../../../constants/echomoji';

const AvatarCustomizer = ({
  currentSkin, currentHair, currentMood,
  currentOutfit, currentEye, currentEyebrow, currentMouth,
  onSave, onCancel,
}) => {
  const [selectedSkinId, setSelectedSkinId] = useState(currentSkin?.id || 'light');
  const [selectedHairId, setSelectedHairId] = useState(currentHair || 'short');
  const [selectedOutfitId, setSelectedOutfitId] = useState(currentOutfit || 'default');
  const [selectedEyeId, setSelectedEyeId] = useState(currentEye || 'brown');
  const [selectedEyebrowId, setSelectedEyebrowId] = useState(currentEyebrow || 'natural');
  const [selectedMouthId, setSelectedMouthId] = useState(currentMouth || null);
  const [previewAnimation, setPreviewAnimation] = useState('idle');

  const activeSkin = SKINS.find(s => s.id === selectedSkinId) || SKINS[0];

  const handleSave = () => {
    onSave({
      activeSkin: selectedSkinId,
      hairStyle: selectedHairId,
      outfit: selectedOutfitId,
      eyeColor: selectedEyeId,
      eyebrowStyle: selectedEyebrowId,
      mouthStyle: selectedMouthId,
    });
  };

  const SectionTitle = ({ children }) => (
    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.5px' }}>
      {children}
    </div>
  );

  const scrollRow = { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' };

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '16px',
      padding: '20px',
      marginTop: '16px',
      border: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>
      {/* Live Preview */}
      <div style={{
        background: 'var(--bg-input)',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
      }}>
        <ECHOMOJI
          mood={currentMood || 'happy'}
          skin={activeSkin}
          hairStyle={selectedHairId}
          outfitId={selectedOutfitId}
          eyeColorId={selectedEyeId}
          eyebrowStyleId={selectedEyebrowId}
          mouthStyleId={selectedMouthId}
          animation={previewAnimation}
          size={110}
          interactive={false}
          animated={true}
        />
      </div>

      {/* Animation Tester */}
      <div style={{ width: '100%' }}>
        <SectionTitle>TEST ANIMATION</SectionTitle>
        <div style={scrollRow}>
          {['idle', 'wave', 'jump', 'cry', 'dance', 'none'].map((anim) => (
            <button
              key={anim}
              onClick={() => setPreviewAnimation(anim)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: previewAnimation === anim ? '2px solid #EC4899' : '1px solid var(--border-color)',
                background: previewAnimation === anim ? 'rgba(236, 72, 153, 0.15)' : 'var(--bg-input)',
                color: previewAnimation === anim ? '#EC4899' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
              }}
            >
              {anim === 'none' ? 'Off' : anim}
            </button>
          ))}
        </div>
      </div>

      {/* Hair */}
      <div style={{ width: '100%' }}>
        <SectionTitle>HAIR STYLE</SectionTitle>
        <div style={scrollRow}>
          {HAIR_STYLES.map((hair) => (
            <button
              key={hair.id}
              onClick={() => setSelectedHairId(hair.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: selectedHairId === hair.id ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
                background: selectedHairId === hair.id ? 'rgba(108, 60, 225, 0.1)' : 'var(--bg-input)',
                color: selectedHairId === hair.id ? '#6C3CE1' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {hair.name}
            </button>
          ))}
        </div>
      </div>

      {/* Skin */}
      <div style={{ width: '100%' }}>
        <SectionTitle>SKIN TONE</SectionTitle>
        <div style={scrollRow}>
          {SKINS.map((skin) => (
            <button
              key={skin.id}
              onClick={() => setSelectedSkinId(skin.id)}
              title={skin.name}
              style={{
                width: '44px', height: '44px', borderRadius: '50%',
                border: selectedSkinId === skin.id ? '3px solid #6C3CE1' : '2px solid var(--border-color)',
                background: `linear-gradient(135deg, ${skin.skinLight}, ${skin.skinBase}, ${skin.skinShadow})`,
                cursor: 'pointer', flexShrink: 0,
                boxShadow: selectedSkinId === skin.id ? '0 0 12px rgba(108, 60, 225, 0.4)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Outfit */}
      <div style={{ width: '100%' }}>
        <SectionTitle>OUTFIT</SectionTitle>
        <div style={scrollRow}>
          {OUTFITS.map((outfit) => (
            <button
              key={outfit.id}
              onClick={() => setSelectedOutfitId(outfit.id)}
              title={outfit.name}
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                border: selectedOutfitId === outfit.id ? '3px solid #6C3CE1' : '2px solid var(--border-color)',
                background: outfit.color
                  ? `linear-gradient(135deg, ${outfit.color}, ${outfit.shadow})`
                  : 'linear-gradient(135deg, #6C3CE1, #4A2A9E)',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: selectedOutfitId === outfit.id ? '0 0 12px rgba(108, 60, 225, 0.4)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Eye Color */}
      <div style={{ width: '100%' }}>
        <SectionTitle>EYE COLOR</SectionTitle>
        <div style={scrollRow}>
          {EYE_COLORS.map((eye) => (
            <button
              key={eye.id}
              onClick={() => setSelectedEyeId(eye.id)}
              title={eye.name}
              style={{
                width: '40px', height: '40px', borderRadius: '50%',
                border: selectedEyeId === eye.id ? '3px solid #6C3CE1' : '2px solid var(--border-color)',
                background: eye.color,
                cursor: 'pointer', flexShrink: 0,
                boxShadow: selectedEyeId === eye.id ? '0 0 12px rgba(108, 60, 225, 0.4)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Eyebrows */}
      <div style={{ width: '100%' }}>
        <SectionTitle>EYEBROWS</SectionTitle>
        <div style={scrollRow}>
          {EYEBROW_STYLES.map((brow) => (
            <button
              key={brow.id}
              onClick={() => setSelectedEyebrowId(brow.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: selectedEyebrowId === brow.id ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
                background: selectedEyebrowId === brow.id ? 'rgba(108, 60, 225, 0.1)' : 'var(--bg-input)',
                color: selectedEyebrowId === brow.id ? '#6C3CE1' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {brow.name}
            </button>
          ))}
        </div>
      </div>

      {/* Mouth */}
      <div style={{ width: '100%' }}>
        <SectionTitle>MOUTH</SectionTitle>
        <div style={scrollRow}>
          <button
            onClick={() => setSelectedMouthId(null)}
            style={{
              padding: '8px 16px', borderRadius: '20px',
              border: selectedMouthId === null ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
              background: selectedMouthId === null ? 'rgba(108, 60, 225, 0.1)' : 'var(--bg-input)',
              color: selectedMouthId === null ? '#6C3CE1' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
            }}
          >
            Auto
          </button>
          {MOUTH_STYLES.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMouthId(m.id)}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                border: selectedMouthId === m.id ? '2px solid #6C3CE1' : '1px solid var(--border-color)',
                background: selectedMouthId === m.id ? 'rgba(108, 60, 225, 0.1)' : 'var(--bg-input)',
                color: selectedMouthId === m.id ? '#6C3CE1' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', width: '100%' }}>
        <button
          onClick={handleSave}
          style={{ flex: 1, background: 'linear-gradient(135deg, #6C3CE1, #EC4899)', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Save Avatar
        </button>
        <button
          onClick={onCancel}
          style={{ flex: 1, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AvatarCustomizer;
